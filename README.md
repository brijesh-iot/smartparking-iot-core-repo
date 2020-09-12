# SmartParking IoT Core Repo

This is the repository for the code going to be deployed at IoT Core.

#### Useful GitHub commands

```bash
git clone git@github.com:awssmartparking/edge-repo.git

git init
git add -A
git commit -m "Initial Load"
git remote add origin git@github.com-awssmartparking:awssmartparking/edge-repo.git
git push -u origin master
```

#### Note

- Make sure you provide the proper value of CoreName in smartparking-iot-core-repo -> configuration.json (Same value provided in CloudFormation Template)
- Modify file smartparking-iot-core-repo -> alerts -> mysqlconfig.json
- Modify file smartparking-iot-core-repo -> device-register -> config.json
- Modify file smartparking-iot-core-repo -> device-status -> config.json
- Find and execute database scripts from smartparking-iot-core-repo -> dbscript.txt
