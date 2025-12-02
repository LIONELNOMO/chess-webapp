var board = null;
var game = new Chess();
var currentMoveIndex = 0;
var currentLanguage = 'en';
// Default variation will be set after loading variations
var currentVariation = '';
var isDragging = false;
var selectedSquare = null;

// Helper to get URL parameters
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

document.addEventListener('DOMContentLoaded', function () {
    // Initialize language from URL or default
    var langParam = getUrlParameter('lang');
    if (langParam && (langParam === 'fr' || langParam === 'en')) {
        currentLanguage = langParam;
    }

    // Initialize variation
    if (typeof variations !== 'undefined' && Object.keys(variations).length > 0) {
        currentVariation = Object.keys(variations)[0];
    }

    // Initialize UI
    setLanguage(currentLanguage);

    // Initialize Board
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    board = Chessboard('board', config);

    $('#board').on('click', '.square-55d63', function () {
        var square = $(this).data('square');
        onSquareClick(square);
    });

    $(window).resize(board.resize);
});

document.addEventListener('touchmove', function (e) {
    if (isDragging || e.target.closest('#board-container')) {
        e.preventDefault();
    }
}, { passive: false });

function setLanguage(lang) {
    currentLanguage = lang;

    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    // Find the button for this language and activate it
    var btn = document.querySelector(`.lang-btn[onclick="setLanguage('${lang}')"]`);
    if (btn) btn.classList.add('active');

    updateInterfaceText();
    updateVariationButtons();
}

function setVariation(variationKey) {
    currentVariation = variationKey;

    document.querySelectorAll('.var-btn').forEach(btn => btn.classList.remove('active'));
    var btn = document.getElementById('btn-' + variationKey);
    if (btn) btn.classList.add('active');

    resetGame();
}

function updateVariationButtons() {
    if (typeof translations === 'undefined' || !translations[currentLanguage]) return;

    const vars = translations[currentLanguage].variations;
    for (const key in vars) {
        const btn = document.getElementById('btn-' + key);
        if (btn) {
            btn.textContent = vars[key];
        }
    }
}

function updateInterfaceText() {
    if (typeof translations === 'undefined' || !translations[currentLanguage]) return;

    const t = translations[currentLanguage];
    document.getElementById('title').textContent = t.title;
    document.getElementById('subtitle').textContent = t.subtitle;
    document.getElementById('explanationTitle').textContent = t.explanationTitle;
    document.getElementById('resetBtn').textContent = t.resetBtn;
    document.getElementById('historyTitle').textContent = t.historyTitle;

    updateStatusForCurrentMove();
}

function updateStatusForCurrentMove() {
    if (!currentVariation || !variations[currentVariation]) return;

    const currentMoves = variations[currentVariation];
    if (currentMoveIndex < currentMoves.length) {
        var nextMove = currentMoves[currentMoveIndex];
        if (nextMove.isWhite) {
            updateStatus(translations[currentLanguage].yourTurn + nextMove.move, 'your-turn');
        }
    }
}

function updateStatus(message, className) {
    var statusDiv = document.getElementById('status');
    statusDiv.innerHTML = message;
    statusDiv.className = 'status ' + className;
}

function showExplanation(text) {
    document.getElementById('explanationText').textContent = text;
    document.getElementById('explanation').style.display = 'block';
}

function hideExplanation() {
    document.getElementById('explanation').style.display = 'none';
}

function showFinalReport() {
    document.getElementById('reportTitle').textContent = translations[currentLanguage].reportTitle;
    document.getElementById('reportMessage').textContent = translations[currentLanguage].completionMessage;
    document.getElementById('finalReport').style.display = 'block';
}

function updateMoveHistory() {
    var history = game.history();
    var html = '';

    for (var i = 0; i < history.length; i += 2) {
        var moveNum = Math.floor(i / 2) + 1;
        var white = history[i];
        var black = history[i + 1] || '';
        html += '<div class="move-item">' + moveNum + '. ' + white + (black ? ' ' + black : '') + '</div>';
    }

    document.getElementById('moveList').innerHTML = html || '<span style="color: #94a3b8;">' + translations[currentLanguage].noMoves + '</span>';
}

function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-square selected-square');
}

function highlightSquare(square) {
    var squareEl = $('#board .square-' + square);
    squareEl.addClass('selected-square');
}

function highlightPossibleMoves(square) {
    var moves = game.moves({ square: square, verbose: true });

    moves.forEach(function (move) {
        var squareEl = $('#board .square-' + move.to);
        squareEl.addClass('highlight-square');
    });
}

function onSquareClick(square) {
    const currentMoves = variations[currentVariation];
    if (currentMoveIndex >= currentMoves.length) return;

    var expectedMove = currentMoves[currentMoveIndex];
    if (!expectedMove.isWhite) return;

    removeHighlights();

    var piece = game.get(square);

    if (selectedSquare === null) {
        if (piece && piece.color === 'w') {
            selectedSquare = square;
            highlightSquare(square);
            highlightPossibleMoves(square);
        }
    } else {
        var move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q'
        });

        if (move === null) {
            selectedSquare = null;
            if (piece && piece.color === 'w') {
                selectedSquare = square;
                highlightSquare(square);
                highlightPossibleMoves(square);
            }
        } else {
            selectedSquare = null;
            board.position(game.fen());

            if (move.san === expectedMove.move) {
                updateStatus(translations[currentLanguage].correct, 'correct');
                showExplanation(expectedMove.explanation[currentLanguage]);
                updateMoveHistory();
                currentMoveIndex++;

                setTimeout(function () {
                    makeComputerMove();
                }, 1000);
            } else {
                game.undo();
                board.position(game.fen());
                updateStatus(translations[currentLanguage].wrong + expectedMove.move, 'wrong');
            }
        }
    }
}

function makeComputerMove() {
    const currentMoves = variations[currentVariation];
    if (currentMoveIndex >= currentMoves.length) {
        showFinalReport();
        return;
    }

    var expectedMove = currentMoves[currentMoveIndex];

    if (!expectedMove.isWhite) {
        setTimeout(function () {
            game.move(expectedMove.move);
            board.position(game.fen());
            showExplanation(expectedMove.explanation[currentLanguage]);
            updateMoveHistory();
            currentMoveIndex++;

            if (currentMoveIndex < currentMoves.length) {
                var nextMove = currentMoves[currentMoveIndex];
                updateStatus(translations[currentLanguage].yourTurn + nextMove.move, 'your-turn');
            } else {
                showFinalReport();
            }
        }, 600);
    }
}

function onDragStart(source, piece, position, orientation) {
    isDragging = true;
    const currentMoves = variations[currentVariation];

    if (currentMoveIndex >= currentMoves.length) return false;

    var expectedMove = currentMoves[currentMoveIndex];
    if (!expectedMove.isWhite) return false;
    if (piece.search(/^b/) !== -1) return false;
}

function onDrop(source, target) {
    isDragging = false;
    removeHighlights();
    const currentMoves = variations[currentVariation];

    if (currentMoveIndex >= currentMoves.length) return 'snapback';

    var expectedMove = currentMoves[currentMoveIndex];

    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    if (move.san === expectedMove.move) {
        updateStatus(translations[currentLanguage].correct, 'correct');
        showExplanation(expectedMove.explanation[currentLanguage]);
        updateMoveHistory();
        currentMoveIndex++;

        setTimeout(function () {
            makeComputerMove();
        }, 1000);
    } else {
        game.undo();
        board.position(game.fen());
        updateStatus(translations[currentLanguage].wrong + expectedMove.move, 'wrong');
        return 'snapback';
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

function resetGame() {
    game.reset();
    board.position('start');
    currentMoveIndex = 0;
    selectedSquare = null;

    updateMoveHistory();
    hideExplanation();
    document.getElementById('finalReport').style.display = 'none';

    updateStatusForCurrentMove();
}
