import * as fs from "fs";
import yaml from "js-yaml";

interface Item {
  title: string;
  release: string;
  date: string;
  studio: string;
  platform: string;
  notes: string;
  link: string;
}

const items = yaml.load(
  fs.readFileSync("./_data/releases.yml").toString()
) as Item[];

var re = new RegExp(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -0000/);

items.sort((a, b) => {
  console.log({
    // a: a.date,
    aMatch: re.test(a.date),
    // b: b.date,
    bMatch: re.test(b.date),
  });
  const diff = a.date.localeCompare(b.date);
  if (diff !== 0) return diff;

  return a.title.localeCompare(b.title);
});

fs.writeFileSync(
  "./_data/releases.yml",
  yaml.dump(items, { quotingType: '"' })
);
