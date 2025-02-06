const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/submit-score', (req, res) => {
    const { name, score } = req.body;
    const scoreData = { name, score };

    fs.readFile(path.join(__dirname, 'scores.json'), (err, data) => {
        if (err) {
            console.error('Error reading scores file:', err);
            return res.status(500).json({ message: 'Error reading scores file' });
        }

        let scores = [];
        if (data.length) {
            scores = JSON.parse(data);
        }

        scores.push(scoreData);
        scores.sort((a, b) => b.score - a.score); // Sort scores in descending order

        fs.writeFile(path.join(__dirname, 'scores.json'), JSON.stringify(scores, null, 2), (err) => {
            if (err) {
                console.error('Error writing scores file:', err);
                return res.status(500).json({ message: 'Error writing scores file' });
            }
            res.json({ message: 'Score submitted successfully' });
        });
    });
});

app.get('/scores', (req, res) => {
    fs.readFile(path.join(__dirname, 'scores.json'), (err, data) => {
        if (err) {
            console.error('Error reading scores file:', err);
            return res.status(500).json({ message: 'Error reading scores file' });
        }

        let scores = [];
        if (data.length) {
            scores = JSON.parse(data);
        }

        res.json(scores);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});