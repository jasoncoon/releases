import * as fs from 'fs';
import yaml from 'js-yaml';

interface Item {
  title: string;
  release: string;
  date: string;
  studio: string;
  platform: string;
  notes: string;
  link: string;
}

const items = yaml.load(fs.readFileSync('./_data/releases.yml').toString()) as Item[];

items.sort((a, b) => { 
  const date = a.date.localeCompare(b.date);
  if (date !== 0) return date;

  return a.title.localeCompare(b.title);
});

fs.writeFileSync('./_data/releases.yml', yaml.dump(items, { quotingType: '"' }));