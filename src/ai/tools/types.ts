export type ToolName =
  | 'open_page'
  | 'log_weight'
  | 'log_food'
  | 'log_workout'
  | 'create_workout_plan'
  | 'create_meal_plan'

export interface ToolCallResult {
  ok: boolean
  message: string
  data?: unknown
}

export interface ToolSpec {
  name: ToolName
  description: string
  parametersSchema: unknown // JSON schema for OpenAI tools
  execute(args: any): Promise<ToolCallResult>
}
