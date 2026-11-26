const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const makeToken = (u) =>
  jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const safeUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  department: u.department, year: u.year
});

// Register (role is ALWAYS student here)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department, year } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ msg: 'Name, email and password required' });
    if (password.length < 6)
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ msg: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, department, year });
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
      return res.status(401).json({ msg: 'Invalid email or password' });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// Who am I (protected)
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(safeUser(user));
});

module.exports = router;