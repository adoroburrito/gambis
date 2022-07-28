import { resolve } from 'path';
import { homedir } from 'os';
import { writeFileSync } from 'fs';
import AWS from 'aws-sdk';
const { DynamoDB } = AWS;
import inquirer from 'inquirer';
import * as dotenv from 'dotenv';
dotenv.config();

console.clear();

const { 
  AWS_ACCESS_KEY_ID, 
  AWS_SECRET_ACCESS_KEY, 
  AWS_REGION, 
  AWS_SESSION_TOKEN
} = process.env;

if(!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION){
  console.log("Before using Dynamojo, please configure needed variables (in .env): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION");
  process.exit(1);
}

const scanAndDump = async (
  //dynamoInstance: typeof DynamoDB, 
  dynamoInstance: any, 
  parameters: { tableName: string, location?: string }
): Promise<void> => {
  console.log(`Scanning table "${parameters.tableName}"...`);
  const scanParams = {
    TableName: parameters.tableName
  };

  let result;
  try {
    result = await dynamoInstance.scan(scanParams).promise();
  } catch(error: any) {
    switch(error.code){
      case 'ResourceNotFoundException':
        console.error(`AWS Returned: Resource not found! Is the table name ("${parameters.tableName}") correct?`);
        process.exit(1);
      default:
        console.error('Unknown error while trying to scan dynamo!');
        console.error({error});
        process.exit(1);
    }
  }

  const { Items: items } = result;
  console.log('Converting to JSON...');
  const itemsJSON = JSON.stringify(items, null, 2);
  const fileName = `${new Date().toISOString().split(".")[0]}.json`;
  const finalLocation = parameters.location
    ? resolve(parameters.location, fileName)
    : resolve(homedir(), fileName);

  console.log('Saving dump...');
  writeFileSync(
    finalLocation,
    itemsJSON
  );

  console.log(`Dump was successful. Path: ${finalLocation}`);
}

const main = async (): Promise<void> => {

  const dynamo = new DynamoDB({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN
    }
  });

  const optionName = 'rootOption';
  const optionChoices = {
    scanAndDump: "Scan and dump a table to JSON",
    exit: "Exit"
  };
  inquirer.prompt([
    {
      type: 'list',
      name: optionName,
      message: 'What do you want to do?',
      choices: [...Object.values(optionChoices)]
    }
  ]).then((answers: any) => {
    if(answers[optionName] === optionChoices.exit){
      console.log("Bye bye");
      process.exit(1);
    }

    if(answers[optionName] === optionChoices.scanAndDump){
      inquirer.prompt([
        {
          type: 'input',
          name: 'tableName',
          message: 'Please enter the desired table name.'
        },
        {
          type: 'input',
          name: 'location',
          message: 'Please enter the desired target location. (Blank = home directory)'
        },
      ]).then(async (answers: any) => {
        const tableName = answers["tableName"];
        const location = answers["location"];
        await scanAndDump(dynamo, { tableName, location });
      })
    }
  }).catch((error: any) => {
    console.log({error});
    if (error.isTtyError) {
      console.log("Prompt couldn't be rendered in the current environment");
    } else {
      console.log("Something else went wrong");
    }
  })

}

main();
