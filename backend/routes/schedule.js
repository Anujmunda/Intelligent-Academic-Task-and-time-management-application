const express = require('express');
const router = express.Router();
const { generateStudySchedule } = require('../utils/scheduler');

// Generate study schedule
router.post('/generate', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id is required' 
      });
    }
    
    const result = await generateStudySchedule(user_id);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
