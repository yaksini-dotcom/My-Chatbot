import os
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
SUPABASE_TABLE = os.environ.get('SUPABASE_TABLE', 'contact_details')


TABLE_PATH = quote(SUPABASE_TABLE, safe='')

BASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}


WRITE_HEADERS = {
    **BASE_HEADERS,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}


def table_url(query=''):
    return f'{SUPABASE_URL}/rest/v1/{TABLE_PATH}{query}'


def passthrough(response):
    """Forward Supabase's response as JSON, even if Supabase sent back
    plain text (e.g. an RLS permission error) instead of JSON."""
    try:
        body = response.json()
    except ValueError:
        body = {'error': response.text}
    return jsonify(body), response.status_code


def row_from_form(body):
    """Map the member-form's JSON keys to this table's exact column names."""
    return {
        'FirstName': body.get('firstName'),
        'LastName': body.get('lastName'),
        'Address': body.get('address'),
        'Age': body.get('age'),
        'Gender': body.get('gender'),
        'Phone': body.get('phone'),
        'Email': body.get('email'),
        'Description': body.get('description'),
        'SubmittedAt': body.get('submittedAt'),
    }


# Page routes 

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/member-form')
def member_form():
    return render_template('member-form.html')


@app.route('/login')
def login():
    return render_template('login.html')


#  Members API (backed by Supabase) 

@app.route('/api/members', methods=['GET'])
def get_members():
    response = requests.get(table_url('?select=*&order=id'), headers=BASE_HEADERS)
    return passthrough(response)


@app.route('/api/members', methods=['POST'])
def create_member():
    body = request.get_json()
    row = row_from_form(body)
    response = requests.post(table_url(), headers=WRITE_HEADERS, json=row)
    return passthrough(response)


@app.route('/api/members/<int:member_id>', methods=['PATCH'])
def update_member(member_id):
    body = request.get_json()
    row = row_from_form(body)
    response = requests.patch(
        table_url(f'?id=eq.{member_id}'), headers=WRITE_HEADERS, json=row
    )
    return passthrough(response)


@app.route('/api/members/<int:member_id>', methods=['DELETE'])
def delete_member(member_id):
    response = requests.delete(
        table_url(f'?id=eq.{member_id}'), headers=WRITE_HEADERS
    )
    return passthrough(response)


if __name__ == '__main__':
    app.run(debug=True)