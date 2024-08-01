const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const { v4 } = require("uuid");
require("express-async-errors");

// OPEN AI COMPLETIONS
const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
  organization: process.env["OPENAI_ORGANIZATION"],
});
const TEXT_MODEL_NAME = "gpt-4o";

async function requestChatCompletion(msg) {
  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: "user", content: msg }],
    model: TEXT_MODEL_NAME,
  });
  // console.log(chatCompletion);
  const responseText = chatCompletion.choices[0].message.content;
  return responseText
    .replace("```html", "")
    .replace("```json", "")
    .replace("```", "");
}

// PROMPTING
let actionText = fs.readFileSync(`./prompts/actions.txt`).toString();
let schemaText = fs.readFileSync(`./prompts/schema.txt`).toString();

function withPrompt(title, vars) {
  let txt = fs.readFileSync(`./prompts/${title}.txt`).toString();
  if (vars) {
    for (const key of Object.keys(vars)) {
      txt = txt.replace(`\$${key}`, vars[key]);
    }
  }
  txt = txt.replace(`\$actions`, actionText);
  txt = txt.replace(`\$schema`, schemaText);
  return txt;
}

// SERVICE LAYER
function listStories() {
  return JSON.parse(
    fs.readFileSync("./database/stories.json").toString().trim()
  );
}
function getStory({ storyId }) {
  return JSON.parse(
    fs.readFileSync("./database/stories.json").toString().trim()
  ).find((x) => x.storyId == storyId);
}

function createStory({ name, panels }) {
  const stories = JSON.parse(
    fs.readFileSync("./database/stories.json").toString().trim()
  );
  const newStory = { name, panels, storyId: v4() };
  stories.push(newStory);
  fs.writeFileSync("./database/stories.json", JSON.stringify(stories));
  return newStory;
}

function updateStory({ storyId, name, panels }) {
  const stories = JSON.parse(
    fs.readFileSync("./database/stories.json").toString().trim()
  );
  const story = stories.find((x) => x.storyId == storyId);
  story.name = name;
  story.panels = panels;
  fs.writeFileSync("./database/stories.json", JSON.stringify(stories));
  return story;
}

function deleteStory({ storyId }) {
  const stories = JSON.parse(
    fs.readFileSync("./database/stories.json").toString().trim()
  );
  const storyToRemove = stories.find((x) => x.storyId == storyId);
  const storiesAfterRemove = stories.filter((x) => x != storyToRemove);
  fs.writeFileSync(
    "./database/stories.json",
    JSON.stringify(storiesAfterRemove)
  );
  return storyToRemove;
}

const serviceMap = {
  "list:stories": listStories,
  "get:story": getStory,
  "create:story": createStory,
  "update:story": updateStory,
  "delete:story": deleteStory,
};

// EXPRESS
const app = express();
app.use(express.json());

app.get("/", async function (req, res) {
  const prompt = withPrompt("index");
  const response = await requestChatCompletion(prompt);
  console.log("INDEX:", response);
  res.send(response);
});

app.use("/api", async function (req, res) {
  console.log("REQUEST:", req.url, req.method, req.body, req.query);
  const prompt = withPrompt("api", {
    method: req.method,
    url: req.url,
    body: JSON.stringify(req.body),
    query: JSON.stringify(req.query),
  });

  const response = await requestChatCompletion(prompt);
  console.log("RESPONSE:", response);

  const json = JSON.parse(response);
  if (serviceMap[json.action]) {
    const serviceResponse = await serviceMap[json.action](json);
    console.log("SERVICE:", serviceResponse);
    res.status(200).send(serviceResponse);
  } else {
    res.status(404).jsonp(json);
  }
});

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send("Error");
});

app.listen(3000);
