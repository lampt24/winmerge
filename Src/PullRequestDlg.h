/**
 * @file  PullRequestDlg.h
 *
 * @brief Declaration of the dialog that asks for a pull request URL and token.
 */
#pragma once

#include "TrDialogs.h"
#include "UnicodeString.h"
#include "PullRequestCompare.h"

class CPullRequestDlg : public CTrDialog
{
public:
	explicit CPullRequestDlg(CWnd* pParent = nullptr);

	enum { IDD = IDD_PULL_REQUEST };
	String m_sUrl;
	String m_sToken;
	bool m_bRememberToken;
	PullRequest::Address m_address; /**< Valid after IDOK */

	/** @brief Token to use: typed, saved for the provider, or from the environment. */
	String ResolveToken() const;

protected:
	virtual void DoDataExchange(CDataExchange* pDX) override;
	virtual BOOL OnInitDialog() override;
	virtual void OnOK() override;
	afx_msg void OnClearToken();
	DECLARE_MESSAGE_MAP()
};
