// Thin Anthropic Messages API client with forced tool-use (ТЗ §1, §7.4).

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export interface AnthropicMessage {
	role: 'user' | 'assistant'
	content: string
}

interface ToolSpec {
	name: string
	description?: string
	input_schema: unknown
}

export interface ToolCallParams {
	apiKey: string
	model: string
	system: string
	messages: AnthropicMessage[]
	tool: ToolSpec
	maxTokens?: number
}

/**
 * Calls the model forcing `tool_choice` to the given tool and returns its raw
 * input object. Throws if the model did not emit the expected tool_use block.
 */
export async function callTool(params: ToolCallParams): Promise<unknown> {
	const { apiKey, model, system, messages, tool, maxTokens = 1024 } = params

	const res = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': API_VERSION,
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			system,
			messages,
			tools: [tool],
			tool_choice: { type: 'tool', name: tool.name },
		}),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Anthropic ${res.status}: ${text}`)
	}

	const data = (await res.json()) as {
		content?: Array<{ type: string; name?: string; input?: unknown }>
	}
	const block = data.content?.find((b) => b.type === 'tool_use' && b.name === tool.name)
	if (!block || block.input === undefined) {
		throw new Error(`No tool_use(${tool.name}) in response`)
	}
	return block.input
}
