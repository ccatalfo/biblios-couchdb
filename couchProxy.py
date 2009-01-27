#!/usr/bin/python
from couchdb import Server, Document
import cgi
#import cgitb; cgitb.enable()
import simplejson

print "Content-Type: application/json\n\n"
form = cgi.FieldStorage()

recordsjson = form.getfirst('records','[]')

serverurl = form.getfirst('serverurl', 'http://localhost:5984')

dbname = 'biblios';
server = Server(serverurl)
db = server[dbname]

records = simplejson.loads(recordsjson)


posted = []
for rec in records:
    new_id = db.create({
            'title':rec['Title'],
            'author':rec['Author'],
            'publisher':rec['Publisher'],
            'medium':rec['Medium'],
            'xmlformat':rec['xmlformat'],
            'xml':rec['xml'],
            'dateofpub':rec['DateOfPub'],
            'location':rec['Location'],
            })
    posted.append(new_id)

print simplejson.dumps({'status':'ok', 'records': posted})



