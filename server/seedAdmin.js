require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = 'admin@campus.com';
  if (!(await User.findOne({ email })))
    await User.create({ name: 'Admin', email, role: 'admin', passwordHash: await bcrypt.hash('admin123', 10) });
  console.log('Admin ready: admin@campus.com / admin123');
  process.exit();
})();