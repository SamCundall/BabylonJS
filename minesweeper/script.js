document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('minesweeper');
    const width = 10;
    const height = 10;
    const minesCount = 20;
    let cells = [];
    let mines = [];

    // Initialize the grid
    function createGrid() {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', revealCell);
                grid.appendChild(cell);
                cells.push(cell);
            }
        }
        placeMines();
    }

    // Place mines randomly
    function placeMines() {
        while (mines.length < minesCount) {
            const index = Math.floor(Math.random() * cells.length);
            if (!mines.includes(index)) {
                mines.push(index);
                cells[index].classList.add('mine');
            }
        }
    }

    // Reveal cell
    function revealCell(event) {
        const cell = event.target;
        if (cell.classList.contains('revealed')) return;
        cell.classList.add('revealed');
        if (cell.classList.contains('mine')) {
            cell.style.backgroundColor = 'red';
            cell.textContent = '💣';
            displayGameOver();
            revealAllMines();
        } else {
            const mineCount = countAdjacentMines(cell);
            cell.textContent = mineCount === 0 ? '⛳' : mineCount;
            if (mineCount > 0) {
                cell.style.fontWeight = 'bold';
                switch (mineCount) {
                    case 1:
                        cell.style.color = 'blue';
                        break;
                    case 2:
                        cell.style.color = 'green';
                        break;
                    case 3:
                        cell.style.color = 'yellow';
                        break;
                    case 4:
                        cell.style.color = 'red';
                        break;
                    case 5:
                        cell.style.color = 'maroon';
                        break;
                }
            }
            if (mineCount === 0) {
                revealAdjacentCells(cell);
            }
        }
    }

    // Count adjacent mines
    function countAdjacentMines(cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const neighbor = cells[ny * width + nx];
                    if (neighbor.classList.contains('mine')) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    // Reveal adjacent cells
    function revealAdjacentCells(cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const neighbor = cells[ny * width + nx];
                    if (!neighbor.classList.contains('revealed')) {
                        revealCell({ target: neighbor });
                    }
                }
            }
        }
    }

    // Reveal all mines
    function revealAllMines() {
        mines.forEach(index => {
            const mineCell = cells[index];
            mineCell.classList.add('revealed');
            mineCell.textContent = '💣';
        });
    }

    // Display game over message
    function displayGameOver() {
        const gameOverMessage = document.createElement('div');
        gameOverMessage.id = 'game-over';
        gameOverMessage.textContent = 'Game Over!';
        gameOverMessage.style.textAlign = 'center';
        gameOverMessage.style.marginTop = '10px';
        grid.appendChild(gameOverMessage);

        const playAgainButton = document.createElement('button');
        playAgainButton.textContent = 'Play Again';
        playAgainButton.style.display = 'block';
        playAgainButton.style.margin = '10px auto';
        playAgainButton.addEventListener('click', () => {
            location.reload();
        });
        grid.appendChild(playAgainButton);
    }

    createGrid();
});