const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
require("express-async-errors");

// OPEN AI COMPLETIONS
const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
  organization: process.env["OPENAI_ORGANIZATION"],
});
const TEXT_MODEL_NAME = "gpt-3.5-turbo";

async function requestChatCompletion(msg) {
  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: "user", content: msg }],
    model: TEXT_MODEL_NAME,
  });
  console.log(chatCompletion);
  return chatCompletion.choices[0].message.content;
}

// PROMPTING
let actionText = fs.readFileSync(`./prompts/actions.txt`).toString();

function withPrompt(title, vars) {
  let txt = fs.readFileSync(`./prompts/${title}.txt`).toString();
  for (const key of Object.keys(vars)) {
    txt = txt.replace(`\$${key}`, vars[key]);
  }
  txt = txt.replace(`\$actions`, actionText);
  return txt;
}

// SERVICE LAYER
function listStories() {}
function getStory({ storyId }) {}
function createStory({ name, panels }) {}
function updateStory({ storyId, name, panels }) {}
function deleteStory({ storyId }) {}

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
  res.send(response);
});

app.use("/api", async function (req, res) {
  console.log(req.url, req.method, req.body);
  const prompt = withPrompt("api", {
    method: req.method,
    url: req.url,
    body: JSON.stringify(req.body),
  });
  console.log(prompt);

  const response = await requestChatCompletion(prompt);
  console.log(response);

  const json = JSON.parse(response);
  if (serviceMap[json.action]) {
    const response = await serviceMap[json.action](json);
    res.status(200).send(response);
  } else {
    res.status(404).jsonp(json);
  }
});

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send("Error");
});

app.listen(3000);
