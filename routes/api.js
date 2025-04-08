const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create a temporary directory for code execution
const TEMP_DIR = path.join(__dirname, '../temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

router.post('/run-code', async (req, res) => {
    const { code, experimentId } = req.body;
    const fileName = `${uuidv4()}.js`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
        // Write code to temporary file
        await fs.writeFile(filePath, code);

        // Execute the code
        exec(`node ${filePath}`, (error, stdout, stderr) => {
            // Clean up: delete the temporary file
            fs.unlink(filePath).catch(console.error);

            if (error) {
                return res.json({ error: stderr || error.message });
            }

            res.json({ output: stdout });
        });
    } catch (error) {
        // Clean up: delete the temporary file if it exists
        fs.unlink(filePath).catch(() => {});
        res.json({ error: error.message });
    }
});

module.exports = router; 