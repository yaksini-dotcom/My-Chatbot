import os
import secrets
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv('.env')
load_dotenv('_env')

app = Flask(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

BASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}

WRITE_HEADERS = {
    **BASE_HEADERS,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

USERS_TABLE = 'Users'
NOTES_TABLE = 'NotesHistory'


def supabase_table_url(table_name, query=''):
    return f'{SUPABASE_URL}/rest/v1/{quote(table_name, safe="")}{query}'


def passthrough(response):
    try:
        body = response.json()
    except ValueError:
        body = {'error': response.text}
    return jsonify(body), response.status_code


def user_to_json(user):
    return {
        'id': user.get('id'),
        'firstName': user.get('first_name'),
        'lastName': user.get('last_name'),
        'email': user.get('email'),
        'token': user.get('token'),
    }


#  Page routes 

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/notes')
def notes_page():
    return render_template('notes.html')


#  Auth: login by email only (existing user) 

@app.route('/api/chat-users/login', methods=['POST'])
def chat_login_email():
    body = request.get_json() or {}
    email = (body.get('email') or '').strip().lower()
    if not email:
         return jsonify({'error': 'email is required.'}), 400

    lookup = requests.get(
        supabase_table_url(USERS_TABLE, f'?email=eq.{quote(email)}&select=*'),
        headers=BASE_HEADERS,
    )
    if not lookup.ok:
        return passthrough(lookup)

    rows = lookup.json()
    if not rows:
        return jsonify({'error': 'No account found with that email. Please register.'}), 404

    user = rows[0]
    if not user.get('token'):
        token = secrets.token_urlsafe(32)
        patch = requests.patch(
            supabase_table_url(USERS_TABLE, f"?id=eq.{user['id']}"),
            headers=WRITE_HEADERS,
            json={'token': token},
        )
        if patch.ok and patch.json():
            user = patch.json()[0]

    result = user_to_json(user)
    result['isNewUser'] = False
    return jsonify(result), 200


#  Auth: register with first/last/email 

@app.route('/api/chat-users', methods=['POST'])
def chat_register():
    body = request.get_json() or {}
    first_name = (body.get('firstName') or '').strip()
    last_name  = (body.get('lastName')  or '').strip()
    email      = (body.get('email')     or '').strip().lower()

    if not first_name or not last_name or not email:
        return jsonify({'error': 'firstName, lastName, and email are required.'}), 400

    # Check if already exists
    lookup = requests.get(
        supabase_table_url(USERS_TABLE, f'?email=eq.{quote(email)}&select=*'),
        headers=BASE_HEADERS,
    )
    if not lookup.ok:
        return passthrough(lookup)

    if lookup.json():
        return jsonify({'error': 'An account with this email already exists. Please sign in instead.'}), 409

    token = secrets.token_urlsafe(32)
    insert = requests.post(
        supabase_table_url(USERS_TABLE),
        headers=WRITE_HEADERS,
        json={
            'first_name': first_name,
            'last_name':  last_name,
            'email':      email,
            'token':      token,
        },
    )
    if not insert.ok:
        return passthrough(insert)

    data = insert.json()
    if not data:
        return jsonify({'error': 'User was not created.'}), 500

    result = user_to_json(data[0])
    result['isNewUser'] = True
    return jsonify(result), 201


@app.route('/api/chat-users/validate', methods=['GET'])
def validate_chat_token():
    token = request.args.get('token', '')
    if not token:
        return jsonify({'valid': False}), 400

    lookup = requests.get(
        supabase_table_url(USERS_TABLE, f'?token=eq.{quote(token)}&select=*'),
        headers=BASE_HEADERS,
    )
    if not lookup.ok:
        return passthrough(lookup)

    rows = lookup.json()
    if not rows:
        return jsonify({'valid': False}), 404

    result = user_to_json(rows[0])
    result['valid'] = True
    return jsonify(result), 200


#  Notes 

@app.route('/api/notes-history/all', methods=['GET'])
def get_all_notes():
    notes_res = requests.get(
        supabase_table_url(NOTES_TABLE, '?select=*&order=created_at.desc'),
        headers=BASE_HEADERS,
    )
    if not notes_res.ok:
        return passthrough(notes_res)

    notes = notes_res.json() or []
    if not notes:
        return jsonify([]), 200

    user_ids = list({n['user_id'] for n in notes if n.get('user_id') is not None})
    user_map = {}
    if user_ids:
        id_filter = 'id=in.(' + ','.join(str(uid) for uid in user_ids) + ')'
        users_res = requests.get(
            supabase_table_url(USERS_TABLE, f'?{id_filter}&select=id,first_name,last_name'),
            headers=BASE_HEADERS,
        )
        if users_res.ok:
            for u in (users_res.json() or []):
                user_map[u['id']] = u

    enriched = []
    for n in notes:
        uid  = n.get('user_id')
        user = user_map.get(uid, {})
        enriched.append({**n, 'first_name': user.get('first_name', ''), 'last_name': user.get('last_name', '')})

    return jsonify(enriched), 200


@app.route('/api/notes-history', methods=['GET'])
def get_notes_history():
    user_id = request.args.get('userId')
    query = '?select=*&order=created_at.desc'
    if user_id: 
        query = f'?user_id=eq.{user_id}&select=*&order=created_at.desc'
    response = requests.get(supabase_table_url(NOTES_TABLE, query), headers=BASE_HEADERS)
    return passthrough(response)
   

@app.route('/api/notes-history', methods=['POST'])
def create_note_history():
    body      = request.get_json() or {}
    user_id   = body.get('userId')
    note_text = (body.get('note') or '').strip()

    if not user_id or not note_text:
        return jsonify({'error': 'userId and note are required.'}), 400

    response = requests.post(
        supabase_table_url(NOTES_TABLE),
        headers=WRITE_HEADERS,
        json={'user_id': user_id, 'notes': note_text},
    )
    return passthrough(response)
 

@app.route('/api/notes-history/<int:note_id>', methods=['PATCH'])
def edit_note_history(note_id):
    
    token = request.headers.get('X-User-Token', '')
    if not token:
        return jsonify({'error': 'Authentication required.'}), 401

    token_res = requests.get(
        supabase_table_url(USERS_TABLE, f'?token=eq.{quote(token)}&select=id'),
        headers=BASE_HEADERS,
    )
    if not token_res.ok or not token_res.json():
        return jsonify({'error': 'Invalid token.'}), 401

    user_id = token_res.json()[0]['id']

    note_res = requests.get(
        supabase_table_url(NOTES_TABLE, f'?id=eq.{note_id}&select=user_id'),
        headers=BASE_HEADERS,
    )
    if not note_res.ok or not note_res.json():
        return jsonify({'error': 'Note not found.'}), 404

    if note_res.json()[0]['user_id'] != user_id:
        return jsonify({'error': 'You can only edit your own notes.'}), 403

    body = request.get_json() or {}
    note_text = (body.get('note') or '').strip()
    if not note_text:
        return jsonify({'error': 'note text is required.'}), 400

    patch_res = requests.patch(
        supabase_table_url(NOTES_TABLE, f'?id=eq.{note_id}'),
        headers=WRITE_HEADERS,
        json={'notes': note_text},
    )
    return passthrough(patch_res)


@app.route('/api/notes-history/<int:note_id>', methods=['DELETE'])
def delete_note_history(note_id):
    
    token = request.headers.get('X-User-Token', '')
    if not token:
        return jsonify({'error': 'Authentication required.'}), 401

    token_res = requests.get(
        supabase_table_url(USERS_TABLE, f'?token=eq.{quote(token)}&select=id'),
        headers=BASE_HEADERS,
    )
    if not token_res.ok or not token_res.json():
        return jsonify({'error': 'Invalid token.'}), 401

    user_id = token_res.json()[0]['id']

    note_res = requests.get(
        supabase_table_url(NOTES_TABLE, f'?id=eq.{note_id}&select=user_id'),
        headers=BASE_HEADERS,
    )
    if not note_res.ok or not note_res.json():
        return jsonify({'error': 'Note not found.'}), 404

    if note_res.json()[0]['user_id'] != user_id:
        return jsonify({'error': 'You can only delete your own notes.'}), 403

    del_res = requests.delete(
        supabase_table_url(NOTES_TABLE, f'?id=eq.{note_id}'),
        headers=WRITE_HEADERS,
    )
    return passthrough(del_res)

if __name__ == '__main__':
    app.run(debug=True)