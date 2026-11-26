const router = require('express').Router();
const Club = require('../models/Club');
const User = require('../models/User');
const { auth, role } = require('../middleware/auth');

// Public: approved clubs
router.get('/', async (req, res) => {
  const q = { status: 'approved' };
  if (req.query.category) q.category = req.query.category;
  const clubs = await Club.find(q).lean();
  res.json(clubs.map(c => ({ ...c, memberCount: c.members.length, members: undefined })));
});

// Admin: pending clubs (must be above /:id)
router.get('/pending', auth, role('admin'), async (req, res) => {
  res.json(await Club.find({ status: 'pending' }).populate('admins', 'name email'));
});

router.get('/pending', auth, role('admin'), async (req, res) => {
  const clubs = await Club.find({ status: 'pending' }).populate('admins', 'name');
  res.json(clubs);
});

router.get('/:id', async (req, res) => {
  const club = await Club.findById(req.params.id).populate('admins', 'name');
  if (!club) return res.status(404).json({ msg: 'Club not found' });
  res.json(club);
});

// Any logged-in user can propose a club
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, category } = req.body;
    if (!name) return res.status(400).json({ msg: 'Club name required' });
    const club = await Club.create({
      name, description, category,
      admins: [req.user.id], members: [req.user.id]
    });
    res.status(201).json(club);
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ msg: e.code === 11000 ? 'Club name taken' : e.message });
  }
});

router.post('/:id/join', auth, async (req, res) => {
  const club = await Club.findOneAndUpdate(
    { _id: req.params.id, status: 'approved' },
    { $addToSet: { members: req.user.id } }, { new: true });
  if (!club) return res.status(404).json({ msg: 'Club not found or not approved' });
  res.json({ msg: 'Joined', memberCount: club.members.length });
});

// Admin approve/reject
router.put('/:id/approve', auth, role('admin'), async (req, res) => {
  const club = await Club.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  if (!club) return res.status(404).json({ msg: 'Club not found' });
  await User.updateMany({ _id: { $in: club.admins }, role: 'student' }, { role: 'clubAdmin' });
  res.json(club);
});

router.put('/:id/reject', auth, role('admin'), async (req, res) => {
  const club = await Club.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
  if (!club) return res.status(404).json({ msg: 'Club not found' });
  res.json(club);
});

module.exports = router;