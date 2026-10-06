/**
 * The emojis the player form's picker offers (ADR 020), grouped for the
 * grid. Single code points or simple variation sequences only, all from
 * Unicode 13 or older, so they render on every phone. Medals and the
 * stats page's icons are left out so they don't get mixed up with players.
 */
export const EMOJI_GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: "Animals",
    emojis: (
      "🦊 🐻 🐙 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐶 🐱 🐭 🐹 🐰 🐔 🐧 🦆 🦅 🦉 🦇 🐺 🐗 " +
      "🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦖 🦕 🦀 🦞 🦑 🐡 🐠 🐬 🐳 🦈 🐊 🦓 🦒 🦘 🦥 🦦"
    ).split(" "),
  },
  {
    name: "Faces",
    emojis: "😀 😎 🤓 🥳 😇 🤠 🤑 😈 👻 💀 🤖 👽 👾 🤡 🥸 🧐 😴 🤩 😏 🤯 🥶 🥵 🤪 🙈".split(" "),
  },
  {
    name: "People",
    emojis: "🧙 🧛 🧜 🧚 🦸 🦹 🥷 🧞 🧟 👑 🎩 🧢 🕶️ 💪 👀 🧠".split(" "),
  },
  {
    name: "Food",
    emojis: "🍕 🍔 🌮 🍣 🍩 🍪 🧁 🍿 🥨 🥑 🍌 🍓 🍉 🍍 🥥 🌶️ 🍺 🍷 🍸 ☕".split(" "),
  },
  {
    name: "Sport & fun",
    emojis: "⚽ 🏀 🏈 🎾 🏓 ⛳ 🏄 🚴 🎿 🥊 🎸 🎮 🎧 🎨 🎲 🃏 🎯 🎰 🎳 🪁".split(" "),
  },
  {
    name: "Money & things",
    emojis: "💰 🪙 💵 📈 🏦 🎁 🔮 🗿 🛸 ✈️ 🚗 🏎️ ⛵ 🚁 🏰 🛠️ 💡 🔔 ⚓ 🦾".split(" "),
  },
  {
    name: "Nature",
    emojis: "⚡ 🌈 ⭐ 🌙 ☀️ 🍀 🌵 🌻 🌸 🍄 🌊 ❄️ ⛄ 🌋 🌍 🪐".split(" "),
  },
];
