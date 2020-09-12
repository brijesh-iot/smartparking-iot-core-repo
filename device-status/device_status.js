var moment = require('moment');
let mysql = require('mysql');

exports.handler =  (eventOriginal, context, callback) =>
{
    console.log( "Context  :: " + JSON.stringify(context)  )
    console.log( 'Event Object Original (string) : ' + JSON.stringify(eventOriginal) )

	//var event = JSON.parse( eventOriginal.messages[0].payload );  # Remove format of messages[] used in IoT event. Handlled generic way.

	var event = eventOriginal;

	console.log( 'Payload (string) : ' + JSON.stringify(event) )

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

    // Read existing entry for status change
    pool.getConnection(function(err, connection)
    {
        if (err)
        {
            console.log( 'Error in DB connection during read existing data : ' + err );
            callback( err )
        }

        var tablename = process.env.tablename;
        console.log( 'Tablename >> ' + tablename )

        var sql = "SELECT * FROM " +tablename + " WHERE serial_number = '"+event.serial_number+"' ";

        connection.query( sql,

            function (error, results, fields)
            {
                connection.release();

                if (error)
                {
                    console.log( 'Error in read status query >> ' + error )
                    callback(error);
                }
                else
                {
                    console.log( 'Success Obj :' + results )
                    console.log( 'Success (Read status) :' + JSON.stringify( results ) )

                    updateDeviceStatus( event.IsOccupied, results[0], event )
                }
            }
        );
    });

};


function updateDeviceStatus( isOccupied, result, event )
{
    var isOccupiedPrev = result.IsOccupied ? result.IsOccupied : 0;
    console.log( 'IsOccupied current : ' + isOccupied )
    console.log( 'IsOccupied previous : ' + isOccupiedPrev )
    console.log( 'NodeJS Unix time : ' + Math.floor(new Date() / 1000) )

    var comments = event.hasOwnProperty('comment') ? event.comment : ( result.comment ? result.comment : '' );
    console.log( 'Comments : ' + comments )

    var scan = event.hasOwnProperty('scan') ? event.scan : ( result.scan ? result.scan : 0 );
    console.log( 'Scan : ' + scan )

    var user_code = event.hasOwnProperty('user_code') ? event.user_code : ( result.user_code ? result.user_code : '' );
    console.log( 'User_code : ' + user_code )

    var tablename = process.env.tablename;
    console.log( 'Tablename >> ' + tablename )

    var parking_start_time = result.parking_start_time ? moment( result.parking_start_time ).format('YYYY-MM-DD HH:mm:ss') : null;
    var parking_end_time = result.parking_end_time ? moment( result.parking_end_time ).format('YYYY-MM-DD HH:mm:ss') : null;

    console.log( "event.status : " + event.status )

    if( event.status == 'online' )
    {
        console.log(" isOccupiedPrev:: " + isOccupiedPrev );
        console.log(" isOccupied:: " + isOccupied );
        // New vehicle has parked
        if( (isOccupiedPrev == 0 && isOccupied == 1 ) )
        {
            scan = ''
            user_code = ''
            parking_start_time = moment( new Date() ).format('YYYY-MM-DD HH:mm:ss')
            // If parking hours selected calculate the end time otherwise take default of 1 hour.
            if( event.hasOwnProperty('parking_hours') )
            {
              parking_end_time = moment( new Date() ).add( (60*event.parking_hours), 'minutes' ).format('YYYY-MM-DD HH:mm:ss')
            }
            else
            {
              parking_end_time = moment( new Date() ).add( (60*1), 'minutes' ).format('YYYY-MM-DD HH:mm:ss')
            }
        }
        // Left
        else if( isOccupiedPrev == 1 && isOccupied == 0 )
        {
            if( result.status != 'offline' )
            {
              parking_end_time =  moment( new Date() ).format('YYYY-MM-DD HH:mm:ss')
            }
        }
    }
    else if( event.status == 'offline' && event.comment == 'Device Maintanance' )
    {
        parking_start_time = null;
        parking_end_time = null;
        scan = ''
        user_code = ''
    }

    console.log( 'Test :: ' + ( event.hasOwnProperty('BatteryLife') ? event.BatteryLife : result.BatteryLife )  )
    console.log( 'Event check : ' + event.hasOwnProperty('BatteryLife')  )
    console.log( 'Result check : ' + result.BatteryLife )

    pool.getConnection(function(err, connection)
    {
        if (err)
        {
            console.log( 'Error in DB connection : ' + err );
            callback( err )
        }

        console.log( "Parking Strat Time: " + parking_start_time )
        console.log( "Parking End Time: " + parking_end_time )

        var sql = "UPDATE " + tablename + " SET "
        + "status = '" + event.status + "' ,"
        + "BatteryLife = '" + ( event.hasOwnProperty('BatteryLife') ? event.BatteryLife : result.BatteryLife ) + "' , "
        + "IsOccupied = '" + ( event.hasOwnProperty('IsOccupied') ? event.IsOccupied : result.IsOccupied ) + "' , "
        + "parking_start_time = '"+ parking_start_time +"' ,"
        + "parking_end_time = '"+ parking_end_time +"' ,"
        + "comment = '" + comments +"' , "
        + "scan = '" + scan +"' , "
        + "user_code = '" + user_code +"' , "
        + "timestamp = '"+ moment( new Date( event.timestamp * 1000 ) ).format('YYYY-MM-DD HH:mm:ss') +"' "
        + "WHERE status_id = '" + result.status_id + "'";

        console.log( 'SQL >> ' + sql )

        connection.query( sql,
            function (error, results, fields)
            {
              connection.release();

              if (error)
              {
                  console.log( 'Error in update status query >> ' + error )
              }
              else
              {
                  console.log( 'Success :' + JSON.stringify( results ) )
              }
          });

      });
}





function publishCallback(err, data) {
    console.log( 'Publish callback...' )
    console.log(err);
    console.log(data);
}







// insert statment
//    let sql = `INSERT INTO AWS_PARKING_DEVICE_MASTER(
//        serial_number,
//        asset,
//        asset_type,
//        location,
//        meter,
//        address,
//        city,
//        state,
//        iot_birth_rule_cloud,
//        iot_birth_rule_edge,
//        iot_data_rule_cloud,
//        iot_data_rule_edge,
//        guid,
//        timestamp)
//    VALUES( event.serial_number )`;
//
//    // execute the insert statment
//    //connection.query(sql);

