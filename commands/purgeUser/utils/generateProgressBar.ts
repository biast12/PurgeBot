interface ProgressBarConfig {
    elapsedChar: string;
    progressChar: string;
    emptyChar: string;
    barLength: number;
}

const defaultConfig: ProgressBarConfig = {
    elapsedChar: "█",
    progressChar: "▓",
    emptyChar: "░",
    barLength: 20,
};

export default function generateProgressBar(
    current: number,
    total: number,
    config: ProgressBarConfig = defaultConfig
): string {
    const { elapsedChar, progressChar, emptyChar, barLength } = config;

    // Ensure barLength is a positive integer
    if (!Number.isInteger(barLength) || barLength <= 0) {
        throw new Error("'barLength' must be a positive integer.");
    }
    // Ensure current and total are within valid ranges
    if (current <= 1) {
        current = 1; // Set to 1 to avoid division by zero
    }
    if (total <= 1) {
        total = 1; // Set to 1 to avoid division by zero
    }
    if (current > total) {
        current = total; // Cap current to total
    }
    // Ensure characters are distinct
    if (elapsedChar === emptyChar || progressChar === emptyChar) {
        throw new Error("'elapsedChar' and 'progressChar' must all be distinct from 'emptyChar'.");
    }

    const progress = Math.min(current / total, 1);
    const filledLength = Math.round(progress * barLength);

    // Ensure no negative repeat counts
    const elapsed = (filledLength > 0 ? elapsedChar.repeat(filledLength - 1) : "") +
        (filledLength > 0 ? progressChar : "");
    const empty = emptyChar.repeat(barLength - filledLength);

    return `${elapsed}${empty}`;
}