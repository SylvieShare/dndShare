package web

func mcpStringProperty(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}
func mcpIntegerProperty(description string) map[string]any {
	return map[string]any{"type": "integer", "description": description}
}
func mcpBooleanProperty(description string) map[string]any {
	return map[string]any{"type": "boolean", "description": description}
}
func mcpObjectSchema(properties map[string]any, required ...string) map[string]any {
	if required == nil {
		required = []string{}
	}
	return map[string]any{"type": "object", "properties": properties, "required": required}
}
func mcpDefinition(name, description string, input map[string]any) map[string]any {
	return map[string]any{"name": name, "description": description, "inputSchema": input}
}
