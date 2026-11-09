/**
 * @file  PullRequestDlg.cpp
 *
 * @brief Implementation of the dialog that asks for a pull request URL and token.
 */

#include "stdafx.h"
#include "PullRequestDlg.h"
#include "OptionsMgr.h"
#include "OptionsDef.h"
#include "resource.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#endif

static const String& TokenOption(PullRequest::Provider provider)
{
	return provider == PullRequest::Provider::GitHub ? OPT_PR_TOKEN_GITHUB : OPT_PR_TOKEN_GITEA;
}

CPullRequestDlg::CPullRequestDlg(CWnd* pParent /*= nullptr*/)
	: CTrDialog(CPullRequestDlg::IDD, pParent)
	, m_sUrl(GetOptionsMgr()->GetString(OPT_PR_LAST_URL))
	, m_bRememberToken(true)
{
}

void CPullRequestDlg::DoDataExchange(CDataExchange* pDX)
{
	CTrDialog::DoDataExchange(pDX);
	DDX_Text(pDX, IDC_PR_URL, m_sUrl);
	DDX_Text(pDX, IDC_PR_TOKEN, m_sToken);
	DDX_Check(pDX, IDC_PR_REMEMBER_TOKEN, m_bRememberToken);
}

BEGIN_MESSAGE_MAP(CPullRequestDlg, CTrDialog)
	ON_BN_CLICKED(IDC_PR_CLEAR_TOKEN, OnClearToken)
END_MESSAGE_MAP()

BOOL CPullRequestDlg::OnInitDialog()
{
	CTrDialog::OnInitDialog();
	const bool hasSaved = !GetOptionsMgr()->GetString(OPT_PR_TOKEN_GITHUB).empty() ||
		!GetOptionsMgr()->GetString(OPT_PR_TOKEN_GITEA).empty();
	EnableDlgItem(IDC_PR_CLEAR_TOKEN, hasSaved);
	if (CEdit* pEdit = static_cast<CEdit*>(GetDlgItem(IDC_PR_URL)))
	{
		pEdit->SetFocus();
		pEdit->SetSel(0, -1);
		return FALSE;
	}
	return TRUE;
}

void CPullRequestDlg::OnOK()
{
	UpdateData(TRUE);
	PullRequest::Address address;
	if (!PullRequest::Address::Parse(m_sUrl, address))
	{
		AfxMessageBox(_("Enter a pull request URL such as\nhttps://github.com/owner/repo/pull/123 (GitHub) or\nhttps://gitea.example.com/owner/repo/pulls/45 (Gitea).").c_str(), MB_ICONWARNING);
		if (CWnd* pEdit = GetDlgItem(IDC_PR_URL))
			pEdit->SetFocus();
		return;
	}
	m_address = address;
	m_sToken = strutils::trim_ws(m_sToken);
	GetOptionsMgr()->SaveOption(OPT_PR_LAST_URL, strutils::trim_ws(m_sUrl));
	if (!m_sToken.empty() && m_bRememberToken)
		GetOptionsMgr()->SaveOption(TokenOption(address.provider), PullRequest::ProtectToken(m_sToken));
	CTrDialog::OnOK();
}

void CPullRequestDlg::OnClearToken()
{
	GetOptionsMgr()->SaveOption(OPT_PR_TOKEN_GITHUB, String());
	GetOptionsMgr()->SaveOption(OPT_PR_TOKEN_GITEA, String());
	EnableDlgItem(IDC_PR_CLEAR_TOKEN, false);
}

String CPullRequestDlg::ResolveToken() const
{
	if (!m_sToken.empty())
		return m_sToken;
	String token = PullRequest::UnprotectToken(GetOptionsMgr()->GetString(TokenOption(m_address.provider)));
	if (token.empty())
		token = PullRequest::TokenFromEnvironment(m_address.provider);
	return token;
}
