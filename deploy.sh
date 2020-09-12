#!/bin/bash -e

STACK_NAME="${CoreName}-iotcore-stack"

sam package \
    --template-file template.yml \
    --output-template-file packaged.yml \
    --s3-bucket ${ARTIFACTS_BUCKET}

sam deploy \
    --template-file packaged.yml \
    --stack-name ${STACK_NAME} \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides CoreName=${CoreName} IoTResourceS3Bucket=${IOT_RESOURCE_S3_BUCKET} \
    --no-fail-on-empty-changeset