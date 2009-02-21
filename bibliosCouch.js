/**
The MIT License

Copyright (c) 2008, Shawn P. Garbett (www.garbett.org), Jonathan Hicks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */

Ext.namespace('Ext.ux', 'Ext.ux.data');

Ext.ux.data.CouchReader = function(meta, recordType){
  meta = meta || {};
  Ext.ux.data.CouchReader.superclass.constructor.call(this, meta, recordType || meta.fields);
};
Ext.extend(Ext.ux.data.CouchReader, Ext.data.JsonReader, {
  /**
   * This override is primarily to default .value on values.
   * Why so much copying is required seems like poor desing on the extjs libraries part
   */
  readRecords : function(o)
  {
    /**
     * After any data loads, the raw JSON data is available for further custom processing.  If no data is
     * loaded or there is a load exception this property will be undefined.
     * @type Object
     */
    this.jsonData = o;
    if(o.metaData)
    {
        delete this.ef;
        this.meta = o.metaData;
        this.recordType = Ext.data.Record.create(o.metaData.fields);
        this.onMetaChange(this.meta, this.recordType, o);
    }
    var s = this.meta, Record = this.recordType,
        f = Record.prototype.fields, fi = f.items, fl = f.length;

    // Generate extraction functions for the totalProperty, the root, the id, and for each field
    if (!this.ef)
    {
      if(s.totalProperty)   { this.getTotal   = this.getJsonAccessor(s.totalProperty);   }
      if(s.successProperty) { this.getSuccess = this.getJsonAccessor(s.successProperty); }
      this.getRoot = s.root ? this.getJsonAccessor(s.root) : function(p){return p;};

      if (s.id)
      {
        var g = this.getJsonAccessor(s.id);
        this.getId = function(rec)
        {
          var r = g(rec);
          return (r === undefined || r === "") ? null : r;
        };
      }
      else
      {
        this.getId = function(){return null;};
      }
      this.ef = [];
      for(var i = 0; i < fl; i++)
      {
        f = fi[i];
// This is the magic line... All this copying for this one line UGH!!!
        var map = (f.mapping !== undefined && f.mapping !== null) ? f.mapping : 'value.'+f.name;
        this.ef[i] = this.getJsonAccessor(map);
      }
    }

    var root = this.getRoot(o), c = root.length, totalRecords = c, success = true;
    if(s.totalProperty)
    {
          var v = parseInt(this.getTotal(o), 10);
          if(!isNaN(v))
          {
              totalRecords = v;
          }
    }
    if(s.successProperty)
    {
          var v = this.getSuccess(o);
          if(v === false || v === 'false')
          {
              success = false;
          }
    }

    var records = [];

    for(var i = 0; i < c; i++)
    {
      var n = root[i];
      var values = {};
      var id = this.getId(n);
      for(var j = 0; j < fl; j++)
      {
        f = fi[j];
        var v = this.ef[j](n);
        values[f.name] = f.convert((v !== undefined) ? v : f.defaultValue, n);
      }
      var record = new Record(values, id);
      record.json = n;
      records[i] = record;
    }

    return {
        success : success,
        records : records,
        totalRecords : totalRecords
    };
  }
});

Ext.ux.data.CouchStore = function(c) {
  var url = (c.url === undefined || c.url === null) ? '/'+c.db+'/_view/'+c.view : c.url;
  Ext.ux.data.CouchStore.superclass.constructor.call(
    this,
    Ext.apply(c, {
      root: 'rows',
      totalProperty: 'total_rows',
      url: url,
      proxy:  !c.data ? new Ext.data.HttpProxy({url: url}) : undefined,
      reader: new Ext.ux.data.CouchReader(c, c.fields)
  }));
  this.addListener('update', function(store, record, operation) {

    if(operation != Ext.data.Record.COMMIT) return;

    Ext.Ajax.request({
      url: '/'+store.db+'/'+record.data._id,
      method: 'PUT',
      jsonData: record.data,
      waitMsg: (store.waitMsg === undefined || store.waitMsg === null) ? 'Saving Data...' : store.waitMsg
    });
  });
  this.addListener('remove', function(store, record, index) {
    Ext.Ajax.request({
      url: '/'+store.db+'/'+record.data._id+'?rev='+record.data._rev,
      method: 'DELETE',
      waitMsg: (store.waitMsg === undefined || store.waitMsg === null) ? 'Deleting Data...' : store.waitMsg
    });
  });
  this.addListener('add', function(store, records, index){
    for(var i=0; i<records.length; i++) {
      record = records[i];
      Ext.Ajax.request({
        url: '/'+store.db,
        method: 'POST',
        jsonData: record.data,
        waitMsg: (store.waitMsg === undefined || store.waitMsg === null) ? 'Adding Data...' : store.waitMsg
      });
    }
  });

  // Disable caching till I can figure out what to do with _dc, contact couchdb guys
  this.proxy.conn.disableCaching = false;

  // Create a record creation helper
  this.record = Ext.data.Record.create(this.fields);
};
Ext.extend(Ext.ux.data.CouchStore, Ext.data.Store);


var couchcgiurl = '/cgi-bin/couchProxy.py';
var couchserverurl = $('couchserverurl', configDoc).text();

var couchDbStore = new Ext.ux.data.CouchStore({
    db:    'couchdb/biblios',
    view:  'records/all',
    fields: [
        {name: '_id'        },  // I'd love to get rid of this as well
        {name: '_rev'       },  // ditto
        {name: 'Title'   },
        {name: 'Author'   },
        {name: 'Publisher'},
      {
        name: 'Date'
      }
      ,{name: 'xml'},
          {
            name: 'DateOfPub'
          },
      {
        name: 'xmlformat'
      },
      {
        name: 'Location'
      },
      {
        name: 'Medium'
      }
    ]
  }); // CouchStore def
var bibliosCouchGrid =
  new Ext.grid.GridPanel({
    id: 'couchgrid'
    ,height:300
    ,region:'center'
    ,store: couchDbStore
    ,columns:
      [
        {
          header:'Title'
          ,dataIndex:'Title'
        }
        ,{
          header:'Author'
          ,dataIndex:'Author'
        }
        ,{
          header:'Publisher'
          ,dataIndex:'Publisher'
        }
        ,{
          header:'Date'
          ,dataIndex:'Date'
        }
        ,{
          header:'Medium'
          ,dataIndex:'Medium'
        }
        ,{
          header:'Format'
          ,dataIndex:'xmlformat'
        }
        ,{
          header:'Location'
          ,dataIndex:'Location'
        }
      ]
  ,sm: new Ext.grid.RowSelectionModel()
  ,tbar: new Ext.PagingToolbar({
    id: 'couchTbar'
    ,store: couchDbStore
    ,displayInfo: true
    ,items: [
    {
      text: 'Delete'
      ,handler: function(btn) {
        var selected = bibliosCouchGrid.getSelections();
        for( var i = 0; i < selected.length; i++) {
          couchDbStore.remove(selected[i]);
        }
      }
    }
    ,{
      text: 'Save to Folder'
      ,menu: {
        id: 'couchSaveMenu'
        ,items: []
        ,listeners: {
          beforeshow: function(menu, menuItem, e) {
            menu.removeAll();
            var savefiles = getSaveFileNames();
            for(var i = 0; i< savefiles.length; i++) {
              menu.add({
                text: savefiles[i].name
                ,savefileid:savefiles[i].id
                ,handler: function(btn){
                  var records = bibliosCouchGrid.getSelections();
                  for(var i = 0; i < records.length; i++) {
                    if(bibliosdebug) {
                      console.info('saving ' +records[i].data.Title);
                    }
                    showStatusMsg('Saving ' + records[i].data.Title);
                    var record = new DB.Records({
                      title : records[i].data.Title
                      ,author: records[i].data.Author
                      ,publisher: records[i].data.Publisher
                      ,date:records[i].data.Date
                      ,xml:records[i].data.xml
                      ,medium:records[i].data.Medium
                      ,location:'couchdb'
                      ,xmlformat:records[i].data.xmlformat
                      ,Savefiles_id:btn.savefileid
                    }).save();
                    clearStatusMsg();
                  }
                }
              });
            }
          }
        } // couchSaveMenu listeners
      } // couchSaveMenu
    } // saveToFolder
  ] // couchTbar items
  })
});
Ext.getCmp('bibliocenter').items.add(bibliosCouchGrid);
biblios.app.on('updatesendmenu', addCouchToSendMenu);
couchDbStore.load({});

function sendToCouch(records) {

/*  $.ajax({
    url: couchcgiurl
    ,type:'POST'
    ,data: {
      records: Ext.util.JSON.encode(records)
      ,serverurl: couchserverurl
    }
  });
*/
  for(var i = 0; i < records.length; i++) {
    couchDbStore.add(records[i]);
  }
}

function addCouchToSendMenu(menu) {
  if(bibliosdebug) {
    console.info("Adding couchdb folder items to send menu");
    console.info(menu);
  }

    var o = {
      text: 'Couchdb',
      foldername : 'couchdb',
      id: Ext.id(),
      handler: function() {

        // check id of menu to figure out where we're picking records from
        if(bibliosdebug) {
          console.info('handler called from: ' + this + '. saving to ' + this.foldername);
          console.info(menu);
        }
        var records = new Array();
        if( menu.id == 'searchgridSendMenu' ){
          searchrecords = Ext.getCmp('searchgrid').getSelectionModel().getChecked();
          for(var i = 0; i < searchrecords.length; i++) {
            records.push(new Record({
                  xml: searchrecords[i].data.fullrecord
                  ,title: searchrecords[i].data.title
                  ,author: searchrecords[i].data.author
                  ,publisher: searchrecords[i].data.publisher
                  ,date: searchrecords[i].data.date
                })
            );
          }
        }
        else if( menu.id == 'savegridSendMenu' ) {
          savegridrecords = Ext.getCmp('savegrid').getSelectionModel().getChecked();
          for(var i = 0; i < savegridrecords.length; i++) {
            records.push(savegridrecords[i]);
          }
        }
        // from editor
        else {
          var editorid = Ext.getCmp('editorTabPanel').getActiveTab().editorid;
          if(bibliosdebug) {
            console.info(menu.id);
            console.info(editorid);
          }
          var r = new Record({
            xml: UI.editor[editorid].record.XMLString()
            ,title:UI.editor[editorid].record.getTitle()
            ,author:UI.editor[editorid].record.getAuthor()
            ,publisher: UI.editor[editorid].record.getPublisher()
            ,date:UI.editor[editorid].record.getDate()
          });
          if(bibliosdebug) {
            console.info(r);
          }
          records.push(r);
        }
        if(bibliosdebug) {
          console.debug('couchdb: sending recs to couchdb');
          console.info(records);
        }
        sendToCouch(records);
      }
    };
    menu.add( o );
  return true;
}

Ext.getCmp('resourcesPanel').items.get(0).items.add(
  new Ext.tree.TreePanel({
    id: 'couchFolder'
    ,autoScroll:true
    ,leaf:false
    ,root: new Ext.tree.AsyncTreeNode({
      text:'Couchdb'
      ,leaf:true
      ,icon: libPath + 'lib/extjs2/resources/images/default/tree/folder-open.gif'
      ,listeners: {
        click: function(n,e) {
          couchDbStore.load({});
          Ext.getCmp('bibliocenter').layout.setActiveItem(4);
        }
      }
      ,loader: new Ext.tree.TreeLoader({

        }) //couchdb loader
      }) // couchdb root
  })
);
Ext.getCmp('resourcesPanel').doLayout();

