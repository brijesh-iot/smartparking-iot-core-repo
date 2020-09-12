//var moment = require('moment');
let mysql = require('mysql');
var pool;

exports.handler =  (event, context, callback) =>
{
    console.log( "Context  :: " + JSON.stringify(context)  )
    console.log( 'Event Object (string) : ' + JSON.stringify(event) )
    var deviceExist = false;

    console.log( 'Database Host : ' + process.env.dbHost );
    console.log( 'Database Name : ' + process.env.dbName );
    console.log( 'Database Admin : ' + process.env.dbUser );
    console.log( 'Database Password : ' + process.env.dbPass );

    pool = mysql.createPool({
                host     : process.env.dbHost,
                database : process.env.dbName,
                user     : process.env.dbUser,
                password : process.env.dbPass,
    });

    console.log( 'Connection Pool :: ' + pool )

    //prevent timeout from waiting event loop
    context.callbackWaitsForEmptyEventLoop = false;

    pool.getConnection( function(err, connection)
    {
       console.log( 'Connection :: ' + connection )
       if (err)
       {
           console.log( 'Error in DB connection : ' + err );
           publishCallback( err )
       }
       connection.query(
            " select device_id from "+ process.env.deviceTable +" WHERE serial_number = ?", [ event.serial_number ],
            function (error, results, fields)
            {
              connection.release();
              if (error)
              {
                  console.log( 'Error: in select device_id query >> ' + error )
                  publishCallback(error, 'Error: in select device_id query!')
              }
              else
              {
                  console.log( 'Success (device_id check for existance) :' + JSON.stringify( results ) )
                  deviceExist = results.length > 0;

                  console.log( "Is device/serial number '"+ event.serial_number +"' exists? : " + deviceExist )

                  if( deviceExist )
                  {
                      publishCallback(null, "Device with Serial Number "+event.serial_number+" already registered !" );
                      return;
                  }
                  else
                  {
                      console.log( "Device with serial_number '"+event.serial_number+"' does not exist. Let's register the device." )
                      insertDeviceMasterData( event );
                  }
              }
            }
         );
    });

};

function insertDeviceMasterData( event )
{
    pool.getConnection( function(err, connection) {

        if (err)
        {
            console.log( 'Error in DB connection : ' + err );
            publishCallback( err )
        }

        var records = [
            [
              event.serial_number,
              event.asset,
              event.asset_type,
              event.meter,
              event.iot_birth_rule_cloud,
              event.iot_birth_rule_edge,
              event.iot_data_rule_cloud,
              event.iot_data_rule_edge,
              event.guid,
			  //event.timestamp
              //moment( new Date( event.timestamp * 1000 ) ).format('YYYY-MM-DD HH:mm:ss')
              new Date( event.timestamp * 1000 )
            ]
          ];

        // Use the connection
        connection.query(
            "INSERT INTO " + process.env.deviceTable + " ("
            + "serial_number,"
            + "asset,"
            + "asset_type,"
            + "meter_no,"
            + "iot_birth_rule_cloud,"
            + "iot_birth_rule_edge,"
            + "iot_data_rule_cloud,"
            + "iot_data_rule_edge,"
            + "guid,"
            + "timestamp) VALUES ?",
            [records],
            function (error, results, fields)
            {
              connection.release();
              if (error)
              {
                  console.log( 'Error in registration query >> ' + error )
                  publishCallback(error);
              }
              else
              {
                  console.log( 'Success (registration) :' + JSON.stringify( results ) )
                  console.log( "Let's insert data where sensor device has located. ")
                  var devicePK = results.insertId;
                  insertAddressDetails( event, devicePK )
              }
          });
      });
}

function insertAddressDetails( event, devicePK )
{
    pool.getConnection( function(err, connection) {
    if (err)
    {
        console.log( 'Error in DB connection : ' + err );
        publishCallback( err )
    }

    var records = [
        [
          event.address,
          event.city,
          event.state,
          event.zipcode,
          event.location,
          event.area_code,
          //event.timestamp
          //moment( new Date( event.timestamp * 1000 ) ).format('YYYY-MM-DD HH:mm:ss')
          new Date( event.timestamp * 1000 )
        ]
      ];
    // Use the connection
    connection.query(
        "INSERT INTO " + process.env.locationTable + " ("
        + "address,"
        + "city,"
        + "state,"
        + "zipcode,"
        + "location,"
        + "area_code,"
        + "timestamp) VALUES ?",
        [records],
        function (error, results, fields)
        {
          connection.release();
          if (error)
          {
              console.log( 'Error in address query >> ' + error )
              publishCallback(error);
          }
          else
          {
              console.log( 'Success (address) :' + JSON.stringify( results ) )
              console.log( "Let's insert device address mapping data. ")
              insertDeviceAddressMpg( event, devicePK, results.insertId )
          }
      });
  });
}

function insertDeviceAddressMpg( event, devicePK, addressPK )
{
    pool.getConnection( function(err, connection) {
    if (err)
    {
        console.log( 'Error in DB connection : ' + err );
        publishCallback( err )
    }

    var records = [
        [
          devicePK,
          addressPK,
        ]
      ];

    // Use the connection
    connection.query(
        "INSERT INTO " + process.env.deviceLocationMpgTable + " ("
        + "device_id,"
        + "address_id) VALUES ?",
        [records],
        function (error, results, fields)
        {
          connection.release();
          if (error)
          {
              console.log( 'Error in device-address mapping query >> ' + error )
              publishCallback(error);
          }
          else
          {
              console.log( 'Success (address-device mapping) :' + JSON.stringify( results ) )
              console.log( 'Inserting Device Initial Status...' )
              deviceInititalStatus( event );
          }
      });
  });
}

function deviceInititalStatus( event )
{
    pool.getConnection( function(err, connection)
    {
        if (err)
        {
            console.log( 'Error in DB connection (initial status) : ' + err );
            callback( err )
        }
        // Insert into Status table
        var statusTable = process.env.statusTable;
        console.log( 'Device Status table : ' + statusTable );

        var statusRecord = [
            [
                event.serial_number,
                event.status,
                event.BatteryLife,
                event.IsOccupied,
				//event.timestamp
				new Date( event.timestamp * 1000 )
                //moment( new Date( event.timestamp * 1000 ) ).format('YYYY-MM-DD HH:mm:ss')
            ]
        ];

        var statusSql = "INSERT INTO " + statusTable + " ("
        + "serial_number,"
        + "status,"
        + "BatteryLife,"
        + "IsOccupied,"
        + "timestamp) VALUES ?";

        connection.query(
            statusSql,
            [statusRecord],
            function (error, results, fields)
            {
                connection.release();
                if (error)
                {
                    console.log( 'Error in device status query >> ' + error )
                    publishCallback(error);
                }
                else
                {
                    console.log( 'Success (device status):' + JSON.stringify( results ) )
                    publishCallback(null,results);
                }
            });

      });
}

function publishCallback(err, data) {
    console.log( 'Publish callback...' ) 
    console.log(err);
    console.log(data);
}

