import type { FunctionDefinition } from "@/types";

export const functionTemplates: Omit<
  FunctionDefinition,
  "id" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "getCurrentWeather",
    description: "Get the current weather in a given location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g. San Francisco, CA",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "The unit of temperature to return",
        },
      },
      required: ["location"],
    },
    implementation: `/**
 * Returns mock weather data for a given location.
 * In a real app, this would call a weather API.
 */
const { location, unit = 'celsius' } = args;

// Simulate API delay
await new Promise(resolve => setTimeout(resolve, 500));

const temp = unit === 'celsius' ? 22 : 72;
const condition = 'sunny';

return {
  location,
  temperature: temp,
  unit,
  condition,
  forecast: \`\${temp}°\${unit === 'celsius' ? 'C' : 'F'} and \${condition}\`
};`,
    timeout: 5000,
    allowedAPIs: ["console.log"],
  },
  {
    name: "calculateExpression",
    description: "Evaluates a mathematical expression and returns the result",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            'The mathematical expression to evaluate (e.g., "2 + 2", "10 * (5 - 2)")',
        },
      },
      required: ["expression"],
    },
    implementation: `/**
 * Safely evaluates a math expression using the Function constructor.
 * (Note: The sandbox already provides isolation, but this is a common pattern)
 */
const { expression } = args;

try {
  // A simple way to evaluate basic math safely in our sandbox
  // We use Function instead of eval() to avoid local scope access
  const result = new Function(\`return \${expression}\`)();
  
  if (typeof result !== 'number' || isNaN(result)) {
    throw new Error('Result is not a valid number');
  }
  
  return {
    expression,
    result,
    success: true
  };
} catch (error) {
  return {
    expression,
    error: error.message,
    success: false
  };
}`,
    timeout: 2000,
    allowedAPIs: [],
  },
  {
    name: "searchDatabase",
    description: "Searches a mock database for user information",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (name or role)",
        },
      },
      required: ["query"],
    },
    implementation: `/**
 * Simulates a database search.
 * Shows how you can return structured data arrays.
 */
const { query } = args;
const q = query.toLowerCase();

// Mock database
const users = [
  { id: 1, name: 'Alice Smith', role: 'Admin', department: 'Engineering' },
  { id: 2, name: 'Bob Jones', role: 'User', department: 'Marketing' },
  { id: 3, name: 'Charlie Brown', role: 'Editor', department: 'Content' },
  { id: 4, name: 'Diana Prince', role: 'Admin', department: 'Security' }
];

console.log(\`Searching for: \${query}\`);

// Simulate DB latency
await new Promise(resolve => setTimeout(resolve, 300));

const results = users.filter(u => 
  u.name.toLowerCase().includes(q) || 
  u.role.toLowerCase().includes(q) ||
  u.department.toLowerCase().includes(q)
);

return {
  query,
  count: results.length,
  results
};`,
    timeout: 3000,
    allowedAPIs: ["console.log"],
  },
  {
    name: "formatDate",
    description: "Formats a date string according to specific requirements",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "ISO date string to format",
        },
        format: {
          type: "string",
          enum: ["short", "long", "relative"],
          description: "The output format desired",
        },
      },
      required: ["date", "format"],
    },
    implementation: `/**
 * Formats a date using native JS Date APIs.
 */
const { date, format } = args;
const d = new Date(date);

if (isNaN(d.getTime())) {
  throw new Error('Invalid date string provided');
}

switch (format) {
  case 'short':
    // Output: YYYY-MM-DD
    return { result: d.toISOString().split('T')[0] };
    
  case 'long':
    // Output: January 1, 2024
    return { 
      result: d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) 
    };
    
  case 'relative':
    // Simple relative time implementation
    const diff = (new Date() - d) / 1000; // diff in seconds
    
    if (diff < 60) return { result: 'Just now' };
    if (diff < 3600) return { result: \`\${Math.floor(diff/60)} minutes ago\` };
    if (diff < 86400) return { result: \`\${Math.floor(diff/3600)} hours ago\` };
    return { result: \`\${Math.floor(diff/86400)} days ago\` };
    
  default:
    throw new Error('Unsupported format requested');
}`,
    timeout: 1000,
    allowedAPIs: [],
  },
];

export function getTemplates(): FunctionDefinition[] {
  return functionTemplates.map((template) => ({
    ...template,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}
