package store

import _ "embed"

//go:embed schema/118_session_interactions.sql
var schemaSessionInteractionsSQL string

//go:embed schema/169_rps_invitations.sql
var schemaRPSInvitationsSQL string
