// src/app/models/workflow.ts
// Workflow automation models and interfaces

// =============================================================================
// Enums
// =============================================================================

export type NodeType =
  | 'trigger_file_watcher'
  | 'trigger_schedule'
  | 'trigger_manual'
  | 'processor_extract_content'
  | 'processor_llm_analysis'
  | 'processor_anomaly_detection'
  | 'processor_cross_reference'
  | 'processor_summarize'
  | 'action_generate_report'
  | 'action_send_email'
  | 'action_save_to_folder'
  | 'flow_condition'
  | 'flow_delay';

export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type ScheduleType = 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly';

// =============================================================================
// Node Models
// =============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: Position;
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// =============================================================================
// Workflow Models
// =============================================================================

export interface Workflow {
  id: string;
  user_id?: number;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: any[];
  is_enabled: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  is_shared: boolean;
  node_count: number;
  last_run_at?: string;
  updated_at: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  is_shared?: boolean;
}

export interface WorkflowUpdate {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  is_enabled?: boolean;
  is_shared?: boolean;
}

// =============================================================================
// Execution Models
// =============================================================================

export interface NodeLog {
  id: number;
  execution_id: string;
  node_id: string;
  status: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface Execution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  current_node_id?: string;
  completed_nodes: string[];
  failed_nodes: string[];
  context: Record<string, any>;
  error_message?: string;
  error_node_id?: string;
  trigger_type?: string;
  trigger_data?: Record<string, any>;
  started_at: string;
  completed_at?: string;
  node_logs: NodeLog[];
}

export interface ExecutionCreate {
  workflow_id: string;
  trigger_type?: string;
  trigger_data?: Record<string, any>;
  initial_context?: Record<string, any>;
}

// =============================================================================
// Settings Models
// =============================================================================

export interface EmailSettings {
  email_notifications_enabled: boolean;
  notification_email?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
}

export interface UserSettings {
  user_id: number;
  email_notifications_enabled: boolean;
  notification_email?: string;
  smtp_configured: boolean;
}

// =============================================================================
// Node Type Definitions
// =============================================================================

export interface NodeTypeConfig {
  type: string;
  label: string;
  label_en: string;
  icon: string;
  config_schema?: Record<string, ConfigField>;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'array' | 'textarea' | 'time' | 'node_select';
  label?: string;
  required?: boolean;
  default?: any;
  options?: string[];
  min?: number;
  max?: number;
}

export interface NodeTypeDefinitions {
  triggers: NodeTypeConfig[];
  processors: NodeTypeConfig[];
  actions: NodeTypeConfig[];
  flow: NodeTypeConfig[];
}

// =============================================================================
// Response Models
// =============================================================================

export interface WorkflowResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface ExecutionResponse {
  success: boolean;
  execution_id?: string;
  message: string;
  status?: ExecutionStatus;
}
