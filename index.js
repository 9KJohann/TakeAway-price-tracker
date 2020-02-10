const axios = require("axios");
const fs = require("fs").promises;
const JSON5 = require("json5");
require("dotenv").config();

const takeawayUrl = process.env.TAKEAWAY_URL || "https://www.lieferando.de";
const restaurantsPath = process.env.RESTAURANTS_PATH || "/lieferservice-oberfranken-bamberg-96050";

const menueRegEx = /var MenucardProducts = (\[(.|\s)*?\]);/;
const restaurantsRegEx = /var restaurants = (\[(.|\s)*?\]);/;

const restaurantsFile = "./restaurants.json";
const restaurantsUrl = "/lieferservice-oberfranken-bamberg-96050";
const menuePath = "./menues";

const getSavedRestaurants = async () => {
    try {
        const json = await fs.readFile(restaurantsFile, "utf-8");
        return JSON.parse(json);
    } catch (error) {
        return [];
    }
};

const getSavedMenue = async restaurant => {
    try {
        const json = await fs.readFile(`${menuePath}${restaurant}.json`, "utf-8");
        return JSON.parse(json);
    } catch (error) {
        return [];
    }
};

async function getRestaurants() {
    const { data } = await axios.get(takeawayUrl + restaurantsUrl);
    const match = restaurantsRegEx.exec(data);
    //we need to use JSON5 because its not real json and they use single quotes
    if (match) return JSON5.parse(match[1]);
    return [];
}

async function getMenue(restaurantUrl) {
    const { data } = await axios.get(takeawayUrl + "/" + restaurantUrl);
    const match = menueRegEx.exec(data);
    if (match) return JSON.parse(match[1]);
    return [];
}

async function logChange(change) {
    fs.writeFile("changes.log", `${new Date().toLocaleDateString()} ${change}\n`, {
        encoding: "utf-8",
        flag: "a+"
    });
}

async function checkMenue(restaurant) {
    const restaurantUrl = restaurant[30].url;
    const restaurantName = restaurant[4];
    const newMenue = await getMenue(restaurantUrl);
    const oldMenue = await getSavedMenue(restaurantUrl);

    oldMenue.forEach(product => {
        const item = newMenue.find(item => item.name === product.name);
        if (!item) {
            logChange(`${restaurantName}: removed "${product.name}"`);
            return;
        }

        if (product.price !== item.price)
            logChange(
                `${restaurantName}: "${product.name}" price changed ${product.price} => ${item.price}`
            );
    });

    newMenue.forEach(product => {
        const item = oldMenue.find(item => item.name === product.name);
        if (!item) {
            logChange(`${restaurantName}: added "${product.name}" ${product.price}`);
        }
    });
    fs.writeFile(`${menuePath}${restaurantUrl}.json`, JSON.stringify(newMenue, null, 4), "utf-8");
}

async function main() {
    try {
        await fs.mkdir(menuePath);
    } catch (error) {
        //only errors if exists
    }
    const newRestaurants = await getRestaurants(restaurantsUrl);
    const oldRestaurants = await getSavedRestaurants();

    oldRestaurants.forEach(oldRestaurant => {
        const found = newRestaurants.find(newRestaurant => newRestaurant[0] === oldRestaurant[0]);
        if (!found) {
            logChange(`Restaurant "${restaurant[4]}" removed`);
        }
    });

    newRestaurants.forEach(newRestaurant => {
        const found = newRestaurants.find(oldRestaurant => newRestaurant[0] === oldRestaurant[0]);
        if (!found) {
            logChange(`Restaurant "${restaurant[4]}" added`);
        }
    });
    fs.writeFile(restaurantsFile, JSON.stringify(newRestaurants, null, 4), "utf-8");

    newRestaurants.forEach(checkMenue);
}

main();
