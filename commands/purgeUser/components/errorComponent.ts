import { ContainerBuilder, TextDisplayBuilder } from "discord.js";

export default (title: string, description: string) => {
  const container = new ContainerBuilder().setAccentColor(0xff0000);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### **❌ ${title}**`)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(description)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "Please check the input and try again."
    )
  );
  return [container];
};
