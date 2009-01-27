var couchcgiurl = '/cgi-bin/couchProxy.py';
var couchserverurl = $('couchserverurl', configDoc).text();

function sendToCouch(records) {

  $.ajax({
    url: couchcgiurl
    ,type:'POST'
    ,data: {
      records: Ext.util.JSON.encode(records)
      ,serverurl: couchserverurl
    }
  });

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
        console.log('handler called from: ' + this + '. saving to ' + this.foldername);
        var records = new Array();
        if( menu.id == 'searchgridSendMenu' ){
          searchrecords = Ext.getCmp('searchgrid').getSelectionModel().getChecked();
          for(var i = 0; i < searchrecords.length; i++) {
            records.push({
              xml: searchrecords[i].data.fullrecord
              ,title: searchrecords[i].data.title
              ,author: searchrecords[i].data.author
              ,publisher: searchrecords[i].data.publisher
              ,date: searchrecords[i].data.date
            });
          }
        }
        else if( menu.id == 'savegridSendMenu' ) {
          savegridrecords = Ext.getCmp('savegrid').getSelectionModel().getChecked();
          for(var i = 0; i < savegridrecords.length; i++) {
            records.push(savegridrecords[i].data);
          }
        }
        // from editor
        else {
          console.info(menu.id);
          records = [{
            xml: UI.editor[menu.editorid].XMLString()
            ,title:UI.editor[menu.editorid].getTitle()
            ,author:UI.editor[menu.editorid].getAuthor()
            ,publisher: UI.editor[menu.editorid].getPublisher()
            ,date:UI.editor[menu.editorid].getDate()
            }
          ];
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
      ,loader: new Ext.tree.TreeLoader({

        }) //couchdb loader
      }) // couchdb root
  })
);
Ext.getCmp('resourcesPanel').doLayout();

biblios.app.on('updatesendmenu', addCouchToSendMenu);