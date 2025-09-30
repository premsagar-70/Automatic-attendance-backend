const mongoose = require('mongoose')

const SubjectSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  year: { type: Number, required: true },
  semester: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Subject', SubjectSchema)
