# PinDash privacy data inventory

| Data                                                           | Purpose                             | Storage                  | Retention                         | Classification    |
| -------------------------------------------------------------- | ----------------------------------- | ------------------------ | --------------------------------- | ----------------- |
| Email, display name, verification and legal acceptance         | Identity and account administration | PostgreSQL               | Account life + backup expiry      | Personal          |
| Session hashes                                                 | Authentication                      | PostgreSQL               | 30 days maximum                   | Confidential      |
| Pinterest user ID, scopes, encrypted access and refresh tokens | Pinterest connection and publishing | PostgreSQL               | Until disconnect/account deletion | Restricted        |
| OAuth state hashes                                             | OAuth request integrity             | PostgreSQL               | 10 minutes                        | Confidential      |
| Draft text, URLs, boards, schedules and approvals              | Publishing workflow                 | PostgreSQL               | Account/workspace life            | Customer content  |
| Uploaded and derived images                                    | Pin creation and safe preview       | Private object storage   | Account/workspace life            | Customer content  |
| Publication IDs, status and error category                     | History, retries and support        | PostgreSQL               | Account/workspace life            | Customer metadata |
| Audit events                                                   | Security and accountability         | PostgreSQL               | 12 months                         | Confidential      |
| Application logs and traces                                    | Reliability and security            | Monitoring provider      | 30 days                           | Operational       |
| Backups                                                        | Disaster recovery                   | Encrypted backup storage | 30 days                           | Restricted        |

Secrets, raw tokens, authorization codes, signed URLs, and full upstream payloads are prohibited from logs and exports.
