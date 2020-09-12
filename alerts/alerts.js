let mysql = require('mysql');

var AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });

const dynamodb = new AWS.DynamoDB(
{
        httpOptions: {
            timeout: 5000
        },
        maxRetries: 3
}
);

var alertsTableName = process.env.alertsTablename;

exports.handler = (event,context,callback) => {

    console.log( "Enviornment Object : " + JSON.stringify( process.env ) )

    console.log( 'SmartParking--- Alerts/Warnings Table Name : ' + alertsTableName )

    console.log( "Event Object : " + JSON.stringify( event ) )

    context.callbackWaitsForEmptyEventLoop = false;

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

    pool.getConnection( function(err, connection)
    {
       console.log( 'Connection :: ' + connection )
       if (err)
       {
           console.log( 'Error in DB connection : ' + err );
           publishCallback( err )
       }
       var serial_number = event.payload.detector.keyValue;
       console.log( "Serial Number : " + serial_number );

       var sql = "select address.zipcode, address.area_code, "
                    + "CONCAT( address.address, ', ', address.city, ', ', address.state )  as address "
                    + "from "
                    + process.env.deviceMasterTable + " master join "+ process.env.deviceAddressMpgTable +" mpg "
                    + "on master.device_id = mpg.device_id "
                    + "join "+ process.env.addressMasterTable +" address on address.address_id = mpg.address_id "
                    + "WHERE serial_number = ? ";

       console.log( "Select Query : " + sql )

       connection.query( sql, [ serial_number ],
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

                  console.log( "Is device/serial number '"+ serial_number +"' exists? : " + deviceExist )

                  if( !deviceExist )
                  {
                      publishCallback(null, "Device with Serial Number "+serial_number+" not registered !" );
                      return;
                  }
                  else
                  {
                      console.log( "Device with serial_number '"+serial_number+"' does exist. Let's save the IoT Event data." )
                      fireEvent( event, context, callback, results );
                  }
              }
            }
         );
    });


};


function fireEvent(event,context,callback, results) {

    console.log( "SmartParking--- Fire Event started !" );

    var alertType = event.payload.detector.detectorModelName.toString()

    var data = ''
    if( alertType == 'BatteryStatusChangeModel' && event.payload.state.variables )
    {
        data = 'BatteryLife : ' + event.payload.state.variables.BatteryLife.toString()
    }

    var params = {
        Item: { 
                "alert_id": { S: event.payload.eventTriggerDetails.messageId.toString() },
                "event_time": { N: event.eventTime.toString() },
                "serial_number": { S: event.payload.detector.keyValue.toString() },
                "alert_name": { S: alertType },
                "event_name": { S: event.eventName.toString() },
                "event_state": { S: event.payload.state.stateName.toString() },
                "event_data" : { S: data },
                "zipcode" : { N: results[0].zipcode.toString() },
                "parkingzone": { S: results[0].area_code},
                "address" : { S: results[0].address }
        },
        ReturnConsumedCapacity: "TOTAL",
        TableName: alertsTableName
    };

    console.log( "Parameters are, :::" )
    console.log( JSON.stringify( params ) );

    dynamodb.putItem(params, function(err, data) {

        console.log( "Data generated for insert : " + data );
        if (err)
        {
            console.log( "Error while inserting data: " + err );
            callback(err); // an error occurred
        }
        else
        {
            console.log( "Data will be inserted successfully..." );
            callback(null, data); // successful response
        }
    });

    console.log( "SmartParking--- Fire Event completed !" );
}

function publishCallback(err, data) {
    console.log( 'Publish callback...' )
    console.log(err);
    console.log(data);
}