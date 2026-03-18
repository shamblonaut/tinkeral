import type { FunctionDefinition } from "../types";

export const EXAMPLE_FUNCTIONS: Omit<
  FunctionDefinition,
  "id" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a specific location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g. San Francisco, CA",
        },
      },
      required: ["location"],
    },
    implementation: `/**
 * Fetches current weather for a location using a public API.
 */
const { location } = args;
try {
  const encodedLocation = encodeURIComponent(location);
  const response = await fetch(\`https://wttr.in/\${encodedLocation}?format=j1\`);
  
  if (!response.ok) {
    throw new Error(\`Weather API returned \${response.status}\`);
  }
  
  const data = await response.json();
  const current = data.current_condition[0];
  
  return {
    location: data.nearest_area[0].areaName[0].value,
    temperature: \`\${current.temp_C}°C\`,
    condition: current.weatherDesc[0].value,
    humidity: \`\${current.humidity}%\`,
    wind: \`\${current.windspeedKmph} km/h\`
  };
} catch (error) {
  return { error: \`Failed to fetch weather: \${error.message}\` };
}`,
  },
  {
    name: "calculate",
    description: "Perform mathematical calculations",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "The mathematical expression to evaluate, e.g. '2 + 2' or 'Math.sqrt(16)'",
        },
      },
      required: ["expression"],
    },
    implementation: `/**
 * Evaluates a mathematical expression safely.
 */
const { expression } = args;
try {
  // Basic sanitization: only allow numbers, operators, and Math functions
  const sanitized = expression.replace(/[^0-9+*/().\\s-]|Math\\.[a-z]+/gi, (match) => {
    if (/^Math\\.[a-z]+$/i.test(match)) return match;
    return '';
  });
  
  // eslint-disable-next-line no-new-func
  const result = new Function(\`return \${sanitized}\`)();
  
  if (typeof result !== 'number' || isNaN(result)) {
    throw new Error("Result is not a number");
  }
  
  return { result };
} catch (error) {
  return { error: \`Calculation error: \${error.message}\` };
}`,
  },
  {
    name: "get_current_datetime",
    description: "Get the current date and time in a specific timezone",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "The IANA timezone string, e.g. 'America/New_York' or 'Asia/Tokyo'. Defaults to local time.",
        },
      },
      required: [],
    },
    implementation: `/**
 * Returns the current time and date.
 */
const { timezone } = args;
try {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    ...(timezone ? { timeZone: timezone } : {})
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const date = new Date();
  
  return {
    datetime: formatter.format(date),
    timestamp: date.getTime(),
    iso: date.toISOString(),
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  };
} catch (error) {
  return { error: \`Timezone error: \${error.message}\` };
}`,
  },
  {
    name: "format_date",
    description: "Format a date string or timestamp into a readable format",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date string or ISO timestamp to format",
        },
        format: {
          type: "string",
          enum: ["short", "medium", "long", "full"],
          description: "The format style to use",
        },
        timezone: {
          type: "string",
          description: "Optional IANA timezone string",
        },
      },
      required: ["date"],
    },
    implementation: `/**
 * Formats a date string or timestamp.
 */
const { date, format = 'medium', timezone } = args;
try {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date provided");
  }

  const options = {
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(format === 'short' ? { dateStyle: 'short' } :
       format === 'medium' ? { dateStyle: 'medium' } :
       format === 'long' ? { dateStyle: 'long' } :
       format === 'full' ? { dateStyle: 'full', timeStyle: 'full' } :
       { dateStyle: 'medium', timeStyle: 'short' })
  };

  return {
    formatted: new Intl.DateTimeFormat('en-US', options).format(d),
    timezone: options.timeZone
  };
} catch (error) {
  return { error: \`Formatting error: \${error.message}\` };
}`,
  },
];
