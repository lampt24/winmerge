#include "StdAfx.h"
#include "MyReBar.h"
#include "RoundedRectWithShadow.h"
#include "DarkModeLib.h"

BEGIN_MESSAGE_MAP(CMyReBar, CReBar)
	ON_WM_ERASEBKGND()
END_MESSAGE_MAP()

CMyReBar::CMyReBar()
{
}

static inline bool IsHighContrastEnabled()
{
	HIGHCONTRAST hc = { sizeof(HIGHCONTRAST) };
	SystemParametersInfo(SPI_GETHIGHCONTRAST, sizeof(hc), &hc, 0);
	return (hc.dwFlags & HCF_HIGHCONTRASTON) != 0;
}

BOOL CMyReBar::OnEraseBkgnd(CDC* pDC)
{
	CRect rect;
	GetClientRect(&rect);
	pDC->FillSolidRect(&rect, GetSysColor(
		IsHighContrastEnabled() ? COLOR_BTNFACE : COLOR_3DHIGHLIGHT));
	return TRUE;
}

static COLORREF BlendColor(COLORREF a, COLORREF b, float ratio)
{
	auto mix = [ratio](int x, int y) { return static_cast<BYTE>(std::clamp(static_cast<int>(x * ratio + y * (1.f - ratio) + 0.5f), 0, 255)); };
	return RGB(mix(GetRValue(a), GetRValue(b)), mix(GetGValue(a), GetGValue(b)), mix(GetBValue(a), GetBValue(b)));
}

/**
 * @brief Fluent-style hot/pressed/checked state for the main toolbar in light mode:
 * a soft rounded fill instead of the classic themed button frame.
 * Dark mode is painted by darkmodelib, high contrast keeps the system look.
 */
static LRESULT DrawFluentToolbarItem(LPNMTBCUSTOMDRAW pcd, COLORREF clrBack)
{
	switch (pcd->nmcd.dwDrawStage)
	{
	case CDDS_PREPAINT:
		return CDRF_NOTIFYITEMDRAW;
	case CDDS_ITEMPREPAINT:
	{
		const UINT state = pcd->nmcd.uItemState;
		const bool bHot = (state & CDIS_HOT) != 0;
		const bool bPressed = (state & CDIS_SELECTED) != 0;
		const bool bChecked = (state & CDIS_CHECKED) != 0;
		if ((!bHot && !bPressed && !bChecked) || (state & CDIS_DISABLED) != 0)
			return CDRF_DODEFAULT;
		const HDC hdc = pcd->nmcd.hdc;
		const COLORREF clrText = GetSysColor(COLOR_BTNTEXT);
		const float alpha = bPressed ? 0.14f : (bChecked ? 0.10f : 0.07f);
		CRect rc(pcd->nmcd.rc);
		rc.DeflateRect(1, 1);
		const int radius = MulDiv(4, GetDeviceCaps(hdc, LOGPIXELSX), 96);
		DrawRoundedRect(hdc, rc.left, rc.top, rc.Width(), rc.Height(), radius, BlendColor(clrText, clrBack, alpha), clrBack);
		pcd->nmcd.uItemState &= ~static_cast<UINT>(CDIS_HOT | CDIS_CHECKED);
		LRESULT result = TBCDRF_NOEDGES;
		if (bPressed)
			result |= TBCDRF_NOBACKGROUND;
		return result;
	}
	default:
		return CDRF_DODEFAULT;
	}
}

BOOL CMyReBar::OnNotify(WPARAM wParam, LPARAM lParam, LRESULT* pResult)
{
	const NMHDR* pnmh = reinterpret_cast<const NMHDR*>(lParam);
	if (pnmh->code == NM_CUSTOMDRAW && pnmh->idFrom == AFX_IDW_TOOLBAR &&
		!DarkMode::isEnabled() && !IsHighContrastEnabled())
	{
		*pResult = DrawFluentToolbarItem(reinterpret_cast<LPNMTBCUSTOMDRAW>(lParam), GetSysColor(COLOR_3DHIGHLIGHT));
		return TRUE;
	}
	return __super::OnNotify(wParam, lParam, pResult);
}

void CMyReBar::LoadStateFromString(const CString& state)
{
	constexpr int BARCOUNT_MAX = 4;
	unsigned count = 0;
	unsigned id[BARCOUNT_MAX]{};
	int cx[BARCOUNT_MAX]{-1, -1};
	_stscanf_s(state, _T("%u,%u,%d,%u,%d,%u,%d,%u,%d"), &count, &id[0], &cx[0], &id[1], &cx[1], &id[2], &cx[2], &id[3], &cx[3]);
	count = (count > BARCOUNT_MAX) ? BARCOUNT_MAX : count;
	CReBarCtrl& rebar = GetReBarCtrl();
	const unsigned nBarCount = rebar.GetBandCount();
	for (unsigned i = 0; i < count; ++i)
	{
		for (unsigned j = i; j < nBarCount; ++j)
		{
			REBARBANDINFO rbi{ sizeof(REBARBANDINFO), RBBIM_CHILD | RBBIM_SIZE | RBBIM_STYLE };
			rebar.GetBandInfo(j, &rbi);
			if (id[i] != 0 && id[i] == static_cast<unsigned>(GetWindowLong(rbi.hwndChild, GWL_ID)))
			{
				if (j != i)
					rebar.MoveBand(j, i);
				if (cx[i] < 0)
				{
					rbi.fStyle |= RBBS_BREAK;
					rbi.cx = -cx[i];
				}
				else
				{
					rbi.fStyle &= ~RBBS_BREAK;
					rbi.cx = cx[i];
				}
				rbi.fMask &= ~RBBIM_CHILD;
				rebar.SetBandInfo(i, &rbi);
			}
		}
	}
}

CString CMyReBar::GenerateStateString()
{
	CReBarCtrl& rebar = GetReBarCtrl();
	const unsigned nCount = rebar.GetBandCount();
	CString state;
	state.AppendFormat(_T("%d"), nCount);
	for (unsigned i = 0; i < nCount; ++i)
	{
		REBARBANDINFO rbi{ sizeof(REBARBANDINFO), RBBIM_CHILD | RBBIM_SIZE | RBBIM_STYLE };
		rebar.GetBandInfo(i, &rbi);
		state.AppendFormat(_T(",%u,%d"),
			GetWindowLong(rbi.hwndChild, GWL_ID),
			((rbi.fStyle & RBBS_BREAK) != 0) ? -static_cast<int>(rbi.cx) : rbi.cx);
	}
	return state;
}