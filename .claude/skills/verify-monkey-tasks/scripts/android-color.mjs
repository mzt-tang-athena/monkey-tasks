// Reads a screenshot and prints its mean colour, so a check can prove a
// repaint, such as a palette switch, instead of only a tap that landed.
//
//   node android-color.mjs <shot.png> [more.png ...]
//
// Prints one line per image: `<name> mean rgb <r>,<g>,<b> luma <n>`,
// with luma the Rec. 601 luma of the mean, 0 to 255.
import { readPng } from "./png.mjs";

let failed = 0;
for (const path of process.argv.slice(2)) {
  const name = path.split("/").pop();
  let shot;
  try {
    shot = readPng(path);
  } catch (error) {
    failed += 1;
    console.log(`${name} unreadable: ${error.message}`);
    continue;
  }
  const { width, height, data } = shot;
  const pixels = width * height;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const mean = [r, g, b].map((sum) => Math.round(sum / pixels));
  const luma = Math.round(
    0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2],
  );
  console.log(`${name} mean rgb ${mean.join(",")} luma ${luma}`);
}
process.exit(failed > 0 ? 1 : 0);
