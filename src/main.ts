import { Servient, Helpers } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import dotenv from "dotenv";

dotenv.config();

const { GATEWAY_URL = "" } = process.env;

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());
const WoTHelpers = new Helpers(servient);

const getDevices = async (): Promise<string[]> => {
  const devices = (await WoTHelpers.fetch(GATEWAY_URL)) as string[];
  return devices.filter((device) => device.startsWith(GATEWAY_URL));
};

const getDevice = async (
  wot: typeof WoT,
  deviceUrl: string,
): Promise<WoT.ConsumedThing> => {
  const td = await WoTHelpers.fetch(deviceUrl);
  return wot.consume(td as WoT.ThingDescription);
};

const parseProperty = async (output: WoT.InteractionOutput) => {
  const buf = await output.arrayBuffer();
  return Number(Buffer.from(buf).toString());
};

let oldTemperature = 0;
// let oldHumidity = 0;

const main = async () => {
  const wot = await servient.start();
  const devices = await getDevices();
  console.log("Devices URLs:", devices);

  const sensorsDeviceUrl = devices.find((device) => device.includes("eui"));
  const lightDeviceUrl = devices.find((device) => !device.includes("eui"));

  if (!sensorsDeviceUrl) {
    console.error("No sensors device found");
    return;
  }

  if (!lightDeviceUrl) {
    console.error("No light device found");
    return;
  }

  const sensorsDevice = await getDevice(wot, sensorsDeviceUrl);
  const lightDevice = await getDevice(wot, lightDeviceUrl);

  setInterval(async () => {
    const temperature = +(
      await sensorsDevice.readProperty("temperature").then(parseProperty)
    ).toFixed(2);
    console.log("Temperature:", temperature);
    const humidity = +(
      await sensorsDevice.readProperty("humidity").then(parseProperty)
    ).toFixed(2);
    console.log("Humidity:", humidity);

    if (temperature === oldTemperature) {
      return;
    }

    if (temperature >= 27) {
      console.log("Red light");
      await lightDevice.invokeAction("setColor", "red");
    } else {
      console.log("Green light");
      await lightDevice.invokeAction("setColor", "green");
    }

    oldTemperature = temperature;
  }, 5000);
};

main();
