# Updated Project Requirements Document: Automatic Ticket Routing and Resolution System

Below is the refined requirements document, incorporating the new success metrics (two of which must be tracked and showcased on LangSmith or LangFuse in the walkthrough video).

---

## 1. Overview
We aim to deliver a working prototype of an automated ticket routing and resolution service using FastAPI (with Langserve) and ChromaDB. The system must track at least two key metrics to demonstrate performance during Week 2, and showcase evaluation on LangSmith or LangFuse.

## 2. Objectives
1. Automatically route tickets that require human intervention and resolve simple or recurring tickets.  
2. Track performance metrics to measure system quality and effectiveness.  
3. Provide a minimal, efficient approach that can be completed within the given three-day window.

## 3. Scope of Work (Minimal Implementation)
1. Create a FastAPI service that ingests ticket data and uses Langserve for classification.  
2. Store essential ticket information and embeddings in ChromaDB.  
3. Implement a decision flow to either auto-resolve (if confidence is high) or route to human agents.  
4. Track at least two of the provided metrics and integrate them into a demonstration on LangSmith or LangFuse.

## 4. Functional Requirements

### 4.1 Ticket Ingestion
• Provide an endpoint that receives ticket data (title, description).  
• Validate minimal fields; log any malformed requests.

### 4.2 Classification and Routing
• Use Langserve for classification (e.g., to check knowledge base or existing solutions).  
• If confidence ≥ threshold, auto-resolve the ticket; otherwise, assign it to the correct team or agent.

### 4.3 Automatic Resolution
• Check ChromaDB for similar tickets or solutions (vector search).  
• Update ticket status to “resolved” if a direct match is found.  
• Post any relevant resolution back to the user, and log the outcome.

### 4.4 ChromaDB Integration
• Generate embeddings for new tickets.  
• Maintain minimal references (ticket ID, summary, solution pointers).  
• Retrieve embeddings for classification checks.

## 5. Success Metrics & Evaluation (Week 2 Focus)

You must track any 2 of the following metrics and showcase them on LangSmith or LangFuse:

1. **Success Rate at Identifying the Correct Action**  
   - Measure how often the system classifies the ticket action correctly (auto-resolve vs. route).  
2. **Accuracy of Field Updates**  
   - Track precision in updating ticket fields (e.g., status, assigned team).  
3. **Speed of Response**  
   - Log end-to-end response times to ensure quick handling of incoming tickets.  
4. **Error Rates and Types**  
   - Count classification, routing, or system failures over total processed tickets.

At least two of these must be fully tracked and demonstrated in a LangSmith/LangFuse dashboard or report as part of the walkthrough video.

## 6. Non-Functional Requirements
1. **Time Constraint** – MVP must be ready in three days.  
2. **Reliability** – Handle ChromaDB or Langserve downtime gracefully.  
3. **Scalability** – Keep design modular for future enhancements.  
4. **Security** – Secure access to API, ensure minimal data sharing.

## 7. Timeline (3-Day Completion)

### Day 1 (Today)
1. Initialize FastAPI project.  
2. Set up ticket ingestion endpoint.  
3. Configure ChromaDB with basic schema.

### Day 2
1. Integrate Langserve for classification.  
2. Implement auto-resolve logic with ChromaDB lookup.  
3. Begin tracking selected metrics (e.g., correct action rate, accuracy of field updates).

### Day 3
1. Final end-to-end testing and fixes (ticket creation → classification → update/resolve).  
2. Configure LangSmith/LangFuse to display chosen metrics.  
3. Deploy or provide minimal documentation for the MVP.

---

By focusing on the most critical features and clearly tracking two of the listed metrics, this MVP will not only provide functional ticket routing and resolution but also clear insights into system performance and accuracy, all within the three-day deadline.





# Updated Project Requirements Document: Automatic Ticket Routing and Resolution System

Below is an expanded version of the requirements document, focusing on how we will enhance the auto-resolve logic using LangGraph and LangChain with agent tool usage.

---

## 1. Overview
The goal remains to create an automated ticket routing and resolution service. We will now incorporate LangGraph and LangChain agents (with tool use) to handle more complex auto-resolution flows. This expansion allows the system to leverage dynamic decision-making and external data sources when determining ticket solutions.

## 2. Objectives
1. Enhance auto-resolution logic through LangChain’s agent capabilities (e.g., use tools to retrieve or update relevant data).  
2. Maintain existing classification and routing pipeline, while enabling more flexible problem-solving for known and unknown tickets.  
3. Retain the minimal feature approach and meet the current fast-paced timeline where possible.

## 3. Scope of Work (Auto-Resolve Logic Expansion)

1. Integrate LangChain Agents as part of the classification flow:
   - These agents can call “tools” such as knowledge base lookups, external APIs, or reference documents.
   - They use LangGraph to define the flow of conversation or ticket analysis in a structured graph.
2. Enhance logic with:
   - Chain-of-thought reasoning for tickets that may be partially matched in ChromaDB.
   - A fallback mechanism if the agent cannot resolve a ticket confidently, which routes it to human support.

## 4. Functional Requirements

### 4.1 Auto-Resolve Pipeline with Agents
1. When a new ticket arrives, forward it to the LangChain agent.  
2. The agent checks ChromaDB (via vector lookup) for possible matches or solutions.  
3. If the agent needs additional context, it calls a relevant “tool”:
   - Example: querying an internal FAQ, referencing product documentation, or making direct queries to Supabase.  
4. If a suitable resolution is found (confidence ≥ threshold), the agent generates a response to auto-resolve the ticket.  
5. If uncertain, the agent assigns the ticket to a human agent.

### 4.2 LangGraph Integration
1. Define a graphical flow in LangGraph representing the path a ticket might take (initial classification → vector lookup → tool usage → resolution or escalation).  
2. Keep each step minimal: the agent only invokes tools when strictly necessary.  
3. Store necessary logs or debugging data within LangGraph to help evaluate decisions.

### 4.3 Minimal Additional Requirements
- The existing FastAPI endpoints remain mostly unchanged; we only modify the processing layer to incorporate the agent.  
- Persistence in ChromaDB continues for search and retrieval.  
- The system logs any agent decisions (tools used, data retrieved) to measure success and track error types for the aforementioned metrics.

## 5. Non-Functional Requirements (Revisited)
1. **Modularity** – The new agent-based logic should be implemented in such a way that it can be upgraded or replaced without major refactoring.  
2. **Maintainability** – Keep code for agent tools self-contained in case the logic for retrieving knowledge needs updates.  
3. **Performance** – Minimize unnecessary calls to external APIs or knowledge bases (tools).  
4. **Security** – Ensure any new tool usage does not expose private data unintentionally.

## 6. Timeline Impact
- Incorporating agents will require brief additional development for tool setup and agent logic, but the core three-day schedule remains the target.  
- Testing must cover typical ticket scenarios to confirm the agent’s chosen tools and resolution steps work properly.

## 7. Success Criteria
1. The system leverages agents for more dynamic ticket resolution.  
2. Metrics (e.g., resolution success rate, speed of response) show improvements or maintain acceptable thresholds.  
3. Reroutes for uncertain tickets remain clear and consistent with overall workflow.

---

This expanded plan strengthens our auto-resolve mechanism using LangGraph and LangChain agents, while staying within the minimal, fast-delivery mindset. The agent-based approach ensures the system can handle more sophisticated queries and reduce manual intervention for complex tickets.
