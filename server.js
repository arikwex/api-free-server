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
function withPrompt(title, vars) {
  let txt = fs.readFileSync(`./prompts/${title}.txt`).toString();
  if (vars) {
    for (const key of Object.keys(vars)) {
      txt = txt.replace(`\$${key}`, vars[key]);
    }
  }
  txt = txt.replace(`\$state`, JSON.stringify(loadState()));
  return txt;
}

// SERVICE LAYER
function loadState() {
  return JSON.parse(fs.readFileSync("./database/state.json").toString().trim());
}

function saveState(state) {
  fs.writeFileSync("./database/state.json", JSON.stringify(state));
}

// EXPRESS
const app = express();
app.use(express.json());

app.get("/", async function (req, res) {
  const prompt = withPrompt("index");
  const response = await requestChatCompletion(prompt);
  console.log("INDEX:", response);
  res.send(response);
});

function filterHeaders(headers) {
  const keysToKeep = Object.keys(headers).filter(
    (x) => x.toLowerCase().indexOf("api") == 0
  );
  const result = {};
  keysToKeep.forEach((k) => (result[k] = headers[k]));
  return result;
}

app.use("/api", async function (req, res) {
  console.log("REQUEST:", req.url, req.method, req.body, req.query);
  const prompt = withPrompt("api", {
    method: req.method,
    url: req.url,
    headers: JSON.stringify(filterHeaders(req.headers)),
    body: JSON.stringify(req.body),
    query: JSON.stringify(req.query),
  });

  console.log(prompt);
  const response = await requestChatCompletion(prompt);
  console.log("RESPONSE:", response);

  const json = JSON.parse(response);
  if (json.new_state) {
    console.log("STATE UPDATE:", json.new_state);
    saveState(json.new_state);
  }

  res.status(200).send(json.api_response);
});

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send("Error");
});

app.listen(3000);
