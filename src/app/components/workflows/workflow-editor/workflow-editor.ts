// src/app/components/workflows/workflow-editor/workflow-editor.ts
import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { WorkflowService } from '../../../services/workflow.service';
import { ExecutionPanelComponent } from '../execution-panel/execution-panel';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeTypeConfig,
  NodeType
} from '../../../models/workflow';

interface DragState {
  nodeId: string | null;
  startX: number;
  startY: number;
  nodeStartX: number;
  nodeStartY: number;
}

interface ConnectionState {
  sourceId: string | null;
  sourceHandle: string | null;
  tempLine: { x1: number; y1: number; x2: number; y2: number } | null;
}

@Component({
  selector: 'app-workflow-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    TooltipModule,
    ToastModule,
    CheckboxModule,
    DecimalPipe,
    ExecutionPanelComponent
  ],
  providers: [MessageService],
  templateUrl: './workflow-editor.html',
  styleUrl: './workflow-editor.scss'
})
export class WorkflowEditorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Workflow state
  workflow = signal<Workflow | null>(null);
  nodes = signal<WorkflowNode[]>([]);
  edges = signal<WorkflowEdge[]>([]);
  hasChanges = signal(false);

  // UI state
  selectedNodeId = signal<string | null>(null);
  selectedEdgeId = signal<string | null>(null);
  saving = signal(false);
  currentExecutionId = signal<string | null>(null);

  // Canvas state
  canvasOffset = signal({ x: 0, y: 0 });
  zoom = signal(1);
  canvasWidth = 3000;
  canvasHeight = 2000;

  // Palette sections (expanded/collapsed)
  openSections: Record<string, boolean> = {
    triggers: true,
    processors: true,
    actions: false,
    flow: false
  };

  // Drag state
  dragState: DragState = {
    nodeId: null,
    startX: 0,
    startY: 0,
    nodeStartX: 0,
    nodeStartY: 0
  };

  // Connection state
  connectionState: ConnectionState = {
    sourceId: null,
    sourceHandle: null,
    tempLine: null
  };

  // Computed
  selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return this.nodes().find(n => n.id === id) || null;
  });

  nodesList = computed(() =>
    this.nodes().map(n => ({ id: n.id, label: n.label }))
  );

  constructor(
    public workflowService: WorkflowService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Load node types if not already loaded
    if (!this.workflowService.nodeTypes()) {
      this.workflowService.loadNodeTypes();
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== 'new') {
        this.loadWorkflow(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWorkflow(id: string): void {
    this.workflowService.getWorkflow(id).subscribe({
      next: workflow => {
        this.workflow.set(workflow);
        this.nodes.set([...workflow.nodes]);
        this.edges.set([...workflow.edges]);
        this.hasChanges.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Σφάλμα',
          detail: 'Αποτυχία φόρτωσης workflow'
        });
        this.router.navigate(['/workflows']);
      }
    });
  }

  // ===========================================================================
  // Section Toggle
  // ===========================================================================

  toggleSection(section: string): void {
    this.openSections[section] = !this.openSections[section];
  }

  // ===========================================================================
  // Node Operations
  // ===========================================================================

  addNode(type: string, config: NodeTypeConfig): void {
    const id = this.generateId();
    const newNode: WorkflowNode = {
      id,
      type: type as NodeType,
      label: config.label,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      config: this.getDefaultConfig(config)
    };

    this.nodes.update(nodes => [...nodes, newNode]);
    this.hasChanges.set(true);
    this.selectNode(id);
  }

  deleteNode(nodeId: string): void {
    this.nodes.update(nodes => nodes.filter(n => n.id !== nodeId));
    this.edges.update(edges =>
      edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    );

    if (this.selectedNodeId() === nodeId) {
      this.deselectNode();
    }

    this.hasChanges.set(true);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    this.selectedEdgeId.set(null);
  }

  deselectNode(): void {
    this.selectedNodeId.set(null);
  }

  updateNodeLabel(nodeId: string, label: string): void {
    this.nodes.update(nodes =>
      nodes.map(n => n.id === nodeId ? { ...n, label } : n)
    );
    this.hasChanges.set(true);
  }

  updateNodeConfigField(nodeId: string, key: string, value: any): void {
    this.nodes.update(nodes =>
      nodes.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            config: { ...n.config, [key]: value }
          };
        }
        return n;
      })
    );
    this.hasChanges.set(true);
  }

  // ===========================================================================
  // Edge Operations
  // ===========================================================================

  selectEdge(edgeId: string): void {
    this.selectedEdgeId.set(edgeId);
    this.selectedNodeId.set(null);
  }

  deleteEdge(edgeId: string): void {
    this.edges.update(edges => edges.filter(e => e.id !== edgeId));
    this.selectedEdgeId.set(null);
    this.hasChanges.set(true);
  }

  onDeleteEdgeClick(event: MouseEvent, edgeId: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.deleteEdge(edgeId);
  }

  getEdgeMidpointX(edge: WorkflowEdge): number {
    const sourceNode = this.nodes().find(n => n.id === edge.source);
    const targetNode = this.nodes().find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return 0;

    const nodeWidth = 140;
    const x1 = sourceNode.position.x + nodeWidth;
    const x2 = targetNode.position.x;

    return (x1 + x2) / 2;
  }

  getEdgeMidpointY(edge: WorkflowEdge): number {
    const sourceNode = this.nodes().find(n => n.id === edge.source);
    const targetNode = this.nodes().find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return 0;

    const nodeHeight = 80;
    const y1 = sourceNode.position.y + nodeHeight / 2;
    const y2 = targetNode.position.y + nodeHeight / 2;

    return (y1 + y2) / 2;
  }

  getEdgeMidpoint(edge: WorkflowEdge): string {
    return `translate(${this.getEdgeMidpointX(edge)}, ${this.getEdgeMidpointY(edge)})`;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedEdge = this.selectedEdgeId();
      const selectedNode = this.selectedNodeId();

      if (selectedEdge) {
        this.deleteEdge(selectedEdge);
        event.preventDefault();
      } else if (selectedNode) {
        this.deleteNode(selectedNode);
        event.preventDefault();
      }
    }
  }

  getEdgePath(edge: WorkflowEdge): string {
    const sourceNode = this.nodes().find(n => n.id === edge.source);
    const targetNode = this.nodes().find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return '';

    const nodeWidth = 140;
    const nodeHeight = 80;

    // Source: right side of node
    const x1 = sourceNode.position.x + nodeWidth;
    const y1 = sourceNode.position.y + nodeHeight / 2;

    // Target: left side of node
    const x2 = targetNode.position.x;
    const y2 = targetNode.position.y + nodeHeight / 2;

    // Bezier curve control points
    const dx = Math.abs(x2 - x1) * 0.5;

    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  // ===========================================================================
  // Canvas Events
  // ===========================================================================

  onCanvasMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('canvas-container')) {
      this.deselectNode();
      this.selectedEdgeId.set(null);
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    // Handle node dragging
    if (this.dragState.nodeId) {
      const dx = event.clientX - this.dragState.startX;
      const dy = event.clientY - this.dragState.startY;

      this.nodes.update(nodes =>
        nodes.map(n => {
          if (n.id === this.dragState.nodeId) {
            return {
              ...n,
              position: {
                x: Math.max(0, this.dragState.nodeStartX + dx),
                y: Math.max(0, this.dragState.nodeStartY + dy)
              }
            };
          }
          return n;
        })
      );
    }

    // Handle connection drawing
    if (this.connectionState.sourceId) {
      const canvas = (event.target as HTMLElement).closest('.canvas-container');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        this.connectionState.tempLine = {
          ...this.connectionState.tempLine!,
          x2: event.clientX - rect.left,
          y2: event.clientY - rect.top
        };
      }
    }
  }

  onCanvasMouseUp(event: MouseEvent): void {
    if (this.dragState.nodeId) {
      this.hasChanges.set(true);
    }

    this.dragState = {
      nodeId: null,
      startX: 0,
      startY: 0,
      nodeStartX: 0,
      nodeStartY: 0
    };

    this.connectionState = {
      sourceId: null,
      sourceHandle: null,
      tempLine: null
    };
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoom.update(z => Math.max(0.25, Math.min(2, z + delta)));
  }

  // ===========================================================================
  // Node Events
  // ===========================================================================

  onNodeMouseDown(event: MouseEvent, nodeId: string): void {
    event.stopPropagation();

    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return;

    this.dragState = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      nodeStartX: node.position.x,
      nodeStartY: node.position.y
    };
  }

  // ===========================================================================
  // Connection Events
  // ===========================================================================

  onConnectorMouseDown(event: MouseEvent, nodeId: string, handle: string): void {
    event.stopPropagation();

    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return;

    const nodeWidth = 140;
    const nodeHeight = 60;

    this.connectionState = {
      sourceId: nodeId,
      sourceHandle: handle,
      tempLine: {
        x1: node.position.x + nodeWidth,
        y1: node.position.y + nodeHeight / 2,
        x2: node.position.x + nodeWidth,
        y2: node.position.y + nodeHeight / 2
      }
    };
  }

  onConnectorMouseUp(event: MouseEvent, nodeId: string, handle: string): void {
    event.stopPropagation();

    if (this.connectionState.sourceId &&
        this.connectionState.sourceId !== nodeId &&
        handle === 'input') {

      // Check if edge already exists
      const exists = this.edges().some(
        e => e.source === this.connectionState.sourceId && e.target === nodeId
      );

      if (!exists) {
        const newEdge: WorkflowEdge = {
          id: this.generateId(),
          source: this.connectionState.sourceId,
          sourceHandle: 'output',
          target: nodeId,
          targetHandle: 'input'
        };

        this.edges.update(edges => [...edges, newEdge]);
        this.hasChanges.set(true);
      }
    }

    this.connectionState = {
      sourceId: null,
      sourceHandle: null,
      tempLine: null
    };
  }

  // ===========================================================================
  // Zoom
  // ===========================================================================

  zoomIn(): void {
    this.zoom.update(z => Math.min(2, z + 0.1));
  }

  zoomOut(): void {
    this.zoom.update(z => Math.max(0.25, z - 0.1));
  }

  // ===========================================================================
  // Save & Run
  // ===========================================================================

  save(): void {
    const workflow = this.workflow();
    if (!workflow) return;

    this.saving.set(true);

    this.workflowService.updateWorkflow(workflow.id, {
      nodes: this.nodes(),
      edges: this.edges()
    }).subscribe({
      next: () => {
        this.hasChanges.set(false);
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Αποθηκεύτηκε',
          detail: 'Οι αλλαγές αποθηκεύτηκαν'
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Σφάλμα',
          detail: 'Αποτυχία αποθήκευσης'
        });
      }
    });
  }

  run(): void {
    const workflow = this.workflow();
    if (!workflow) return;

    this.workflowService.runWorkflow(workflow.id).subscribe({
      next: response => {
        if (response.execution_id) {
          this.currentExecutionId.set(response.execution_id);
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Εκτέλεση',
          detail: `Workflow ξεκίνησε`
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Σφάλμα',
          detail: 'Αποτυχία εκτέλεσης'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workflows']);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  isTrigger(type: string): boolean {
    return type.startsWith('trigger_');
  }

  getNodeClass(node: WorkflowNode): string {
    if (node.type.startsWith('trigger_')) return 'trigger';
    if (node.type.startsWith('processor_')) return 'processor';
    if (node.type.startsWith('action_')) return 'action';
    if (node.type.startsWith('flow_')) return 'flow';
    return '';
  }

  getNodeIconClass(type: string): string {
    const icons: Record<string, string> = {
      'trigger_file_watcher': 'pi-folder',
      'trigger_schedule': 'pi-clock',
      'trigger_manual': 'pi-play',
      'processor_extract_content': 'pi-file',
      'processor_llm_analysis': 'pi-microchip-ai',
      'processor_anomaly_detection': 'pi-exclamation-triangle',
      'processor_summarize': 'pi-align-left',
      'action_generate_report': 'pi-file-pdf',
      'action_send_email': 'pi-envelope',
      'action_save_to_folder': 'pi-folder-plus',
      'flow_condition': 'pi-code-branch',
      'flow_delay': 'pi-stopwatch'
    };
    return icons[type] || 'pi-circle';
  }

  getNodeTypeLabel(type: string): string {
    const nodeTypes = this.workflowService.nodeTypes();
    if (!nodeTypes) return type;

    const allTypes = [
      ...nodeTypes.triggers || [],
      ...nodeTypes.processors || [],
      ...nodeTypes.actions || [],
      ...nodeTypes.flow || []
    ];

    const found = allTypes.find(t => t.type === type);
    return found?.label_en || type;
  }

  getConfigFields(node: WorkflowNode): Array<{key: string; type: string; label?: string; options?: string[]}> {
    const nodeTypes = this.workflowService.nodeTypes();
    if (!nodeTypes) return [];

    const allTypes = [
      ...nodeTypes.triggers || [],
      ...nodeTypes.processors || [],
      ...nodeTypes.actions || [],
      ...nodeTypes.flow || []
    ];

    const config = allTypes.find(t => t.type === node.type);
    if (!config?.config_schema) return [];

    return Object.entries(config.config_schema).map(([key, schema]: [string, any]) => ({
      key,
      type: schema.type || 'string',
      label: schema.label,
      options: schema.options
    }));
  }

  parseArray(value: string): string[] {
    return value.split(',').map(v => v.trim()).filter(v => v);
  }

  private generateId(): string {
    return 'n_' + Math.random().toString(36).substring(2, 9);
  }

  private getDefaultConfig(nodeConfig: NodeTypeConfig): Record<string, any> {
    const config: Record<string, any> = {};

    if (nodeConfig.config_schema) {
      for (const [key, schema] of Object.entries(nodeConfig.config_schema)) {
        if ((schema as any).default !== undefined) {
          config[key] = (schema as any).default;
        }
      }
    }

    return config;
  }
}
