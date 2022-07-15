const path = require("path");
const random = require("random-seed").create("maxmind");

random.initState();
const randip = () =>
  random(254) + "." + random(254) + "." + random(254) + "." + random(254);

const DB_FILE = path.join(__dirname, "/GeoLite2-City.mmdb");

const Benchmark = require("benchmark");
const suite = new Benchmark.Suite();

const notFound = {};
const foundRecords = {}

const incMetric = (moduleName, d) => {
  d[moduleName] = d[moduleName] ? d[moduleName] + 1 : 1;
}

suite
  .on("cycle", event => {
    random.initState();
    console.log(String(event.target));
  })
  .on("complete", function() {
    console.log("Fastest is " + this.filter("fastest").map("name"));
    console.log('\n\n% Not found IPs')
    for (const [key,value] of Object.entries(foundRecords)){
      if (notFound[key] === undefined) {
        notFound[key] = 1
      }
      console.log(`Module ${key}: % not found IPs: ${value/notFound[key]}`)
    }
  });

const experiment = (name, fn) => {
  suite.add(name, { minSamples: 100, fn });
};



(async () => {
  /******************* maxmind ***********************/
  const maxmind = await require("maxmind").default.open(DB_FILE);
  experiment("maxmind", () => {
    const lookup = maxmind.get(randip());
    if (lookup === undefined || lookup == null) {
      incMetric('maxmind', notFound)
    } else {
      incMetric('maxmind', foundRecords)
    }
  });

  /***************** mmdb-reader *********************/
  const mmdbReader = require("mmdb-reader")(DB_FILE);
  experiment("mmdb-reader", () => {
    const lookup = mmdbReader.lookup(randip());

    if (lookup === undefined || lookup == null) {
      incMetric('mmdb-reader', notFound)
    } else {
      incMetric('mmdb-reader', foundRecords)
    }
  });

  /************* maxmind-db-reader *******************/
  const maxmindDbReader = require("maxmind-db-reader").openSync(DB_FILE);
  experiment("maxmind-db-reader", () => {
    const lookup = maxmindDbReader.getGeoDataSync(randip());

    if (lookup === undefined || lookup == null) {
      incMetric('maxmind-db-reader', notFound)
    } else {
      incMetric('maxmind-db-reader', foundRecords)
    }    
  });

  /******************* jgeoip  ***********************/
  const jgeoip = new (require("jgeoip"))(DB_FILE);
  experiment("jgeoip", () => {
    const lookup = jgeoip.getRecord(randip());

    if (lookup === undefined || lookup == null) {
      incMetric('jgeoip', notFound)
    } else {
      incMetric('jgeoip', foundRecords)
    }      
  });


  /******************* @maxmind/geoip2-node  ***********************/
  const fs = require('fs');
  const geoip2nodeOptions = { cache: { max: 6000 } }
  const geoip2node = require("@maxmind/geoip2-node").Reader.openBuffer(fs.readFileSync(DB_FILE));
  const {AddressNotFoundError} = require("@maxmind/geoip2-node/dist/src/errors")

  experiment("@maxmind/geoip2node", () => {
    try {
      geoip2node.city(randip());
      incMetric('@maxmind/geoip2node', foundRecords)
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
          incMetric('@maxmind/geoip2node', notFound)
      } else {
        throw error
      }
    }
  });
  

  console.log("Benchmarking...");
  suite.run();
})();
