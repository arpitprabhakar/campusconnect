const router = require('express').Router();
const Event = require('../models/Event');
const Club = require('../models/Club');
const RSVP = require('../models/RSVP');
const { auth, role } = require('../middleware/auth');

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Can this user manage this club's events?
async function canManage(user, clubId) {
  if (user.role === 'admin') return true;
  const club = await Club.findById(clubId);
  return !!club && club.status === 'approved' && club.admins.some(a => a.equals(user.id));
}

// List + search/filter
router.get('/', async (req, res) => {
  const q = { status: 'approved' };
  if (req.query.search) q.title = new RegExp(escapeRe(req.query.search), 'i');
  if (req.query.club) q.club = req.query.club;
  if (req.query.upcoming === 'true') q.endAt = { $gte: new Date() };
  const events = await Event.find(q).populate('club', 'name category').sort('startAt');
  res.json(events);
});

router.get('/mine', auth, async (req, res) => {
  const rsvps = await RSVP.find({ user: req.user.id, status: { $ne: 'cancelled' } })
    .populate({ path: 'event', populate: { path: 'club', select: 'name' } })
    .sort('-createdAt');
  res.json(rsvps.filter(r => r.event));
});

router.get('/:id', async (req, res) => {
  const event = await Event.findById(req.params.id).populate('club', 'name');
  if (!event) return res.status(404).json({ msg: 'Event not found' });
  const going = await RSVP.countDocuments({ event: event._id, status: 'going' });
  res.json({ ...event.toObject(), going, seatsLeft: Math.max(event.capacity - going, 0) });
});

router.post('/', auth, role('clubAdmin', 'admin'), async (req, res) => {
  try {
    const { title, description, club, venue, startAt, endAt, capacity } = req.body;
    if (!title || !club || !startAt || !endAt)
      return res.status(400).json({ msg: 'title, club, startAt, endAt required' });
    if (new Date(endAt) <= new Date(startAt))
      return res.status(400).json({ msg: 'endAt must be after startAt' });
    if (!(await canManage(req.user, club)))
      return res.status(403).json({ msg: 'You do not manage this club' });
    const event = await Event.create({ title, description, club, venue, startAt, endAt, capacity });
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ msg: e.message }); }
});

router.put('/:id', auth, role('clubAdmin', 'admin'), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ msg: 'Event not found' });
  if (!(await canManage(req.user, event.club))) return res.status(403).json({ msg: 'Forbidden' });
  ['title', 'description', 'venue', 'startAt', 'endAt', 'capacity', 'status']
    .forEach(f => { if (req.body[f] !== undefined) event[f] = req.body[f]; });
  await event.save();
  res.json(event);
});

router.delete('/:id', auth, role('clubAdmin', 'admin'), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ msg: 'Event not found' });
  if (!(await canManage(req.user, event.club))) return res.status(403).json({ msg: 'Forbidden' });
  await RSVP.deleteMany({ event: event._id });
  await event.deleteOne();
  res.json({ msg: 'Deleted' });
});

// RSVP toggle with waitlist
router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== 'approved') return res.status(404).json({ msg: 'Event not found' });
    if (event.endAt < new Date()) return res.status(400).json({ msg: 'Event already ended' });

    const existing = await RSVP.findOne({ event: event._id, user: req.user.id });

    // Already in -> cancel, and promote the first person on the waitlist
    if (existing && existing.status !== 'cancelled') {
      const wasGoing = existing.status === 'going';
      existing.status = 'cancelled';
      await existing.save();
      if (wasGoing) {
        const next = await RSVP.findOne({ event: event._id, status: 'waitlist' }).sort('createdAt');
        if (next) { next.status = 'going'; await next.save(); }
      }
      return res.json({ msg: 'RSVP cancelled' });
    }

    const going = await RSVP.countDocuments({ event: event._id, status: 'going' });
    const status = going < event.capacity ? 'going' : 'waitlist';
    if (existing) { existing.status = status; await existing.save(); }
    else await RSVP.create({ event: event._id, user: req.user.id, status });
    res.status(201).json({ status, msg: status === 'going' ? 'You are going!' : 'Event full, added to waitlist' });
  } catch (e) { res.status(500).json({ msg: e.message }); }
});

module.exports = router;