const csv = require('csv-parser');
const fs = require('fs');
const d3 = require('d3')
 
var result = {}


/*
fileContent = fs.readFileSync('config.csv', {encoding: 'utf8'});
var csvdata = d3.csvParse( fileContent )
console.log( fileContent )
*/

var readStrem = fs.createReadStream('config.csv');

var text = promiseRead( readStrem );

setTimeout(function() {
}, 5000);

console.log( 'text after sleep :: ' + text.then( function(value){
    result = value;
    console.log( 'then block ' + JSON.stringify(result) )

    console.log( 'GUID : ' + value.guid )
    console.log( 'ASSET : ' + value.asset )
    console.log( 'asset_type : ' + value.asset_type )
    console.log( 'iot_rule : ' + value.iot_rule )

} ) )

console.log( 'result == ' + result )

function promiseRead( stream )
{
    result = {}
    return new Promise( ( resolve, reject )=>{

        stream.pipe(csv())
        .on('data', (row) => {
                if( row.guid == '28f63646dc054f6898d23fd450e0a395' )
                {
                    result = row;
                    resolve( result )
                }
            })
        .on('end', () => {
            console.log('CSV file successfully processed : ' + JSON.stringify(result) );
            resolve( result );
        });

    } );
}

 