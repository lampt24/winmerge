#pragma once

#include <afxwin.h>
#include <afxext.h>

class CMyReBar : public CReBar
{
public:
	CMyReBar();
	void LoadStateFromString(const CString& state);
	CString GenerateStateString();

protected:
	virtual BOOL OnNotify(WPARAM wParam, LPARAM lParam, LRESULT* pResult) override;
	afx_msg BOOL OnEraseBkgnd(CDC* pDC);
	DECLARE_MESSAGE_MAP()
};