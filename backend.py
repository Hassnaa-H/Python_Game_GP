from flask import Flask, request, jsonify, send_from_directory
import re

app = Flask(__name__, static_folder='.', static_url_path='')

COMMAND_MAP = {
    'move_right()': 'right',
    'move_left()': 'left',
    'move_up()': 'up',
    'move_down()': 'down'
}

# Define the correct sequence of moves needed to reach the treasure for each level
LEVEL_SEQUENCES = {
    'Level_1': ['right', 'right', 'right', 'right', 'down', 'down','left', 'left', 'left', 'left','down', 'down','right', 'right', 'right', 'right'],
    'Level_2': ['right', 'right','right','down','down', 'right'],
    'Level_3': ['right', 'right','right','right', 'down', 'down','left', 'left', 'left', 'down', 'down','right','right','right'],
    'Level_4': ['right', 'up','right','right','right','right','down', 'down','right', 'right'],
    'Level_5': ['right', 'right', 'right', 'right','right', 'down', 'down','left', 'left', 'left', 'left','left', 'down', 'down','right', 'right', 'right', 'right','right','down', 'down','right'],
    'Level_6': ['right', 'right', 'right', 'right','right','down', 'down','left', 'left', 'left','left','left','down', 'down'],
    'Level_7': ['right','right','right','right','right', 'down', 'down','left', 'left', 'left','left','left','down', 'down','right', 'right', 'right', 'right','right','down', 'down'],
    'Level_8': [ 'right','up', 'right', 'right', 'right','right','up', 'right', 'right','down'],
    'Level_9': ['down','down', 'right', 'down','down','up', 'up','up','up' ,'right', 'right','down', 'right', 'left', 'left','down','down','down', 'right','down','down','down', 'right', 'right'],
    'Level_10': ['down','down', 'right', 'down','down','up', 'up','up','up' ,'right', 'right','down', 'right', 'left', 'left','down','down','down', 'right','down','down','down', 'right', 'right','down' ],
}

WHITESPACE = re.compile(r'\s*', re.ASCII)
FOR_PATTERN = re.compile(
    r'for\s*\(\s*let\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+)\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)\s*\{',
    re.ASCII
)

@app.route('/run', methods=['POST'])
def run_code():
    data = request.get_json(silent=True)
    if not data or 'code' not in data:
        return jsonify(success=False, message='Missing code', moves=[]), 400

    code = data['code']
    level = data.get('level', 'Level_1')
    
    # Get the target sequence for this level
    target_sequence = LEVEL_SEQUENCES.get(level, LEVEL_SEQUENCES['Level_1'])
    
    cleaned_code = remove_comments(code)
    try:
        moves, pos = parse_statements(cleaned_code, 0)
        pos = skip_whitespace(cleaned_code, pos)
        if pos != len(cleaned_code):
            raise ValueError('Unexpected code after parsing at position %d' % pos)
        
        # Find how many moves at the beginning match the target sequence
        correct_moves = []
        for i, move in enumerate(moves):
            if i < len(target_sequence) and move == target_sequence[i]:
                correct_moves.append(move)
            else:
                break  # Stop at the first incorrect move
        
        # Check if all moves are correct
        is_correct = moves == target_sequence
        
        if is_correct:
            return jsonify(
                success=True,
                moves=moves,
                message='Perfect! You reached the treasure with the correct sequence!'
            )
        else:
            # Return correct moves for animation, but mark as failure
            return jsonify(
                success=False,
                moves=correct_moves,
                message=f'Incorrect sequence. '
            ), 400
            
    except ValueError as exc:
        return jsonify(success=False, moves=[], message=str(exc)), 400

@app.route('/', defaults={'path': 'Level_1/Index.html'})
@app.route('/<path:path>')
def static_file(path):
    # Block /run from being served as static file
    if path == 'run':
        return 'Not Found', 404
    try:
        return send_from_directory('.', path)
    except Exception as e:
        return 'Not Found', 404


def remove_comments(code: str) -> str:
    code = re.sub(r'//.*', '', code)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.S)
    return code


def skip_whitespace(code: str, pos: int) -> int:
    while pos < len(code) and code[pos].isspace():
        pos += 1
    return pos


def parse_statements(code: str, pos: int):
    moves = []
    while True:
        pos = skip_whitespace(code, pos)
        if pos >= len(code) or code[pos] == '}':
            break

        if code.startswith('for', pos):
            for_moves, pos = parse_for(code, pos)
            moves.extend(for_moves)
            continue

        matched = False
        for token, direction in COMMAND_MAP.items():
            if code.startswith(token, pos):
                moves.append(direction)
                pos += len(token)
                pos = skip_semicolon(code, pos)
                matched = True
                break

        if matched:
            continue

        raise ValueError('Invalid command or syntax at position %d' % pos)

    return moves, pos


def parse_for(code: str, pos: int):
    match = FOR_PATTERN.match(code, pos)
    if not match:
        raise ValueError('Invalid for-loop syntax at position %d' % pos)

    start = int(match.group(2))
    end = int(match.group(3))
    repeat_count = max(0, end - start)
    pos = match.end()

    body_moves, pos = parse_statements(code, pos)
    pos = skip_whitespace(code, pos)
    if pos >= len(code) or code[pos] != '}':
        raise ValueError('Missing closing brace for for-loop starting at position %d' % match.start())
    pos += 1

    return body_moves * repeat_count, pos


def skip_semicolon(code: str, pos: int) -> int:
    pos = skip_whitespace(code, pos)
    if pos < len(code) and code[pos] == ';':
        pos += 1
    return pos


if __name__ == '__main__':
    app.run(debug=True)
