require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'CampusConnect API is running' }));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/me', require('./routes/me'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => console.log('Server up on', process.env.PORT));
  })
  .catch(err => console.error('DB error:', err.message));