const router = require('express').Router();
const RSVP = require('../models/RSVP');
const { auth } = require('../middleware/auth');

router.get('/events', auth, async (req, res) => {
  const rsvps = await RSVP.find({ user: req.user.id, status: { $ne: 'cancelled' } })
    .populate({ path: 'event', populate: { path: 'club', select: 'name' } });
  res.json(rsvps);
});

module.exports = router;