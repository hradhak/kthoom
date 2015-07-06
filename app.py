__author__ = 'hari'

from flask import Flask, render_template, send_from_directory
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/book/")
def book():
    return send_from_directory('/home/hari/leviathan/Comics/Red Sonja/', 'Red Sonja 01.cbr')


if __name__ == "__main__":
    app.run(debug=True)

