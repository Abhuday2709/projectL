import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, ScatterChart, ReferenceArea, CartesianGrid, ReferenceLine, XAxis, YAxis, Tooltip, Scatter, Cell, ReferenceDot } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, X } from "lucide-react";
import { ScoringSession } from '@/models/scoringReviewModel';
import { Category } from '@/models/categoryModel';

interface ReviewScore {
    id: string;
    userEmail: string;
    userName: string;
    attractiveness: number;
    abilityToWin: number;
    recommendation: string;
    createdAt: string;
}
interface ReviewWithUser extends ScoringSession {
    userEmail?: string;
    userName?: string;
}
interface AdminScoresGraphProps {
    reviews: ReviewWithUser[];
    isOpen: boolean;
    onClose: () => void;
}
/**
 * CustomTooltip component displays details of a review score on hover.
 *
 * @param {any} props - Contains active status and payload.
 * @returns {JSX.Element | null} Tooltip element if active; otherwise, null.
 *
 * @example
 * <CustomTooltip active={true} payload={[{ payload: reviewData }]} />
 */
const CustomTooltip = ({ active, payload }: any) => {
    console.log(payload,active);
    
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        console.log("data",data);
        
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
                <p className="font-semibold text-sm text-[#112D4E]">{data.userName}</p>
                <p className="text-xs text-gray-600 mb-2">{data.userEmail}</p>
                <p className="text-sm text-blue-600">Attractiveness: {data.attractiveness.toFixed(1)}%</p>
                <p className="text-sm text-green-600">Ability to Win: {data.abilityToWin.toFixed(1)}%</p>
                <p className="text-sm text-purple-600 mt-1">Rec: {data.recommendation}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(data.createdAt).toLocaleDateString()}</p>
            </div>
        );
    }
    return null;
};

// Consistent color palette for quadrants
const COLORS = {
    bidToWin: {
        bg: "bg-green-50",
        border: "border-green-200",
        ring: "ring-green-200",
        text: "text-green-800",
        value: "text-green-900",
        area: "#dcfce7",
        dot: "#059669",
        label: "#059669",
    },
    fasterClosure: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        ring: "ring-blue-200",
        text: "text-blue-800",
        value: "text-blue-900",
        area: "#dbeafe",
        dot: "#2563eb",
        label: "#2563eb",
    },
    buildCapability: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        ring: "ring-orange-200",
        text: "text-orange-800",
        value: "text-orange-900",
        area: "#fed7aa",
        dot: "#d97706",
        label: "#d97706",
    },
    noBid: {
        bg: "bg-red-50",
        border: "border-red-200",
        ring: "ring-red-200",
        text: "text-red-800",
        value: "text-red-900",
        area: "#fee2e2",
        dot: "#dc2626",
        label: "#dc2626",
    }
};
/**
 * Returns the dot color based on review scores relative to a qualification cutoff.
 *
 * @param {number} attractiveness - The attractiveness percentage.
 * @param {number} abilityToWin - The ability to win percentage.
 * @param {number} [qualificationCutoff=50] - The cutoff score.
 * @returns {string} Hex color code for the dot.
 *
 * @example
 * const color = getScoreColor(65, 70, 50);
 */
const getScoreColor = (attractiveness: number, abilityToWin: number, qualificationCutoff: number = 50) => {
    if (attractiveness >= qualificationCutoff && abilityToWin >= qualificationCutoff) {
        return COLORS.bidToWin.dot;
    } else if (attractiveness >= qualificationCutoff && abilityToWin < qualificationCutoff) {
        return COLORS.fasterClosure.dot;
    } else if (attractiveness < qualificationCutoff && abilityToWin >= qualificationCutoff) {
        return COLORS.buildCapability.dot;
    } else {
        return COLORS.noBid.dot;
    }
};
/**
 * AdminScoresGraph React component displays a scatter chart of review scores with interactive quadrant filtering.
 *
 * @param {AdminScoresGraphProps} props - Contains reviews, dialog open state, and onClose callback.
 * @returns {JSX.Element} A dialog component containing the scatter chart.
 *
 * @example
 * <AdminScoresGraph reviews={reviewsArray} isOpen={true} onClose={() => console.log("closed")} />
 */
export default function AdminScoresGraph({ reviews, isOpen, onClose }: AdminScoresGraphProps) {
    const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    // Fetch categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch("/api/category/getCategories");
                if (!res.ok) throw new Error("Failed to fetch categories");
                const data = await res.json();
                // console.log("Fetched categories:", data);
                
                setCategories(data);
            } catch (err) {
                setCategories([]);
            }
        };
        fetchCategories();
    }, []);

    /**
     * Processes review data to compute percentages and produce an array of ReviewScore objects.
     *
     * @returns {ReviewScore[]} Array of processed review score objects.
     *
     * @example
     * const scores = processReviewData();
     */
    const processReviewData = (): ReviewScore[] => {
        const processedData: ReviewScore[] = [];
        // Find the correct category IDs just once
        const abilityCat = categories.find(cat =>
            cat.categoryName.toLowerCase().includes("ability")
        );
        const attractCat = categories.find(cat =>
            cat.categoryName.toLowerCase().includes("attract")
        );

        reviews.forEach(review => {
            if (
                review.scores &&
                typeof review.scores === "object" &&
                abilityCat &&
                attractCat
            ) {
                const scores = review.scores as any;

                // Extract the DynamoDB number value
                const abilityScoreObj = scores[abilityCat.categoryId];
                const attractScoreObj = scores[attractCat.categoryId];

                // If the value is wrapped as { N: "28" }, extract and convert
                const abilityScore = abilityScoreObj && abilityScoreObj.N
                    ? Number(abilityScoreObj.N)
                    : abilityScoreObj
                        ? Number(abilityScoreObj)
                        : null;

                const attractScore = attractScoreObj && attractScoreObj.N
                    ? Number(attractScoreObj.N)
                    : attractScoreObj
                        ? Number(attractScoreObj)
                        : null;

                if (abilityScore !== null && attractScore !== null) {
                    const abilityTotal = review.answers?.length ?? 1;
                    const attractTotal = review.answers?.length ?? 1;

                    const abilityPct = Math.round(
                        (abilityScore * 100) / (abilityTotal)
                    );
                    const attractPct = Math.round(
                        (attractScore * 100) / (attractTotal)
                    );

                    processedData.push({
                        id: review.user_id,
                        userEmail: review.userEmail || "Unknown",
                        userName: review.userName || "Unknown User",
                        attractiveness: attractPct,
                        abilityToWin: abilityPct,
                        recommendation: review.recommendation || "N/A",
                        createdAt: review.createdAt || new Date().toISOString(),
                    });
                }
            }
        });

        return processedData;
    };

    const scoreData = processReviewData();
    const qualificationCutoff = 50; // You can make this configurable
    const abilityQualCutoff = categories.find(cat =>
            cat.categoryName.toLowerCase().includes("ability")
        )?.qualificationCutoff || qualificationCutoff;
    const attractQualCutoff = categories.find(cat =>
            cat.categoryName.toLowerCase().includes("attract")
        )?.qualificationCutoff || qualificationCutoff;
    // Filter data based on selected quadrant
    const filteredData = selectedQuadrant ? scoreData.filter(score => {
        switch (selectedQuadrant) {
            case 'bid-to-win':
                return score.attractiveness >= attractQualCutoff && score.abilityToWin >= abilityQualCutoff;
            case 'build-capability':
                return score.attractiveness >= attractQualCutoff && score.abilityToWin < abilityQualCutoff;
            case 'faster-closure':
                return score.attractiveness < attractQualCutoff && score.abilityToWin >= abilityQualCutoff;
            case 'no-bid':
                return score.attractiveness < attractQualCutoff && score.abilityToWin < abilityQualCutoff;
            default:
                return true;
        }
    }) : scoreData;

    const quadrantCounts = {
        'bid-to-win': scoreData.filter(s => s.attractiveness >= attractQualCutoff && s.abilityToWin >= abilityQualCutoff).length,
        'build-capability': scoreData.filter(s => s.attractiveness >= attractQualCutoff && s.abilityToWin < abilityQualCutoff).length,
        'faster-closure': scoreData.filter(s => s.attractiveness < attractQualCutoff && s.abilityToWin >= abilityQualCutoff).length,
        'no-bid': scoreData.filter(s => s.attractiveness < attractQualCutoff && s.abilityToWin < abilityQualCutoff).length,
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] bg-[#F9F7F7]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between text-[#112D4E]">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                <BarChart3 className="h-4 w-4 text-white" />
                            </div>
                            All Review Scores Overview
                        </div>
                    </DialogTitle>
                    <DialogDescription className="text-[#3F72AF]">
                        Comprehensive view of all evaluation scores from {scoreData.length} review sessions
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col h-full space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                            onClick={() => setSelectedQuadrant(selectedQuadrant === 'bid-to-win' ? null : 'bid-to-win')}
                            className={`p-3 rounded-lg border transition-all ${
                                selectedQuadrant === 'bid-to-win'
                                    ? `${COLORS.bidToWin.bg.replace('50', '100')} ${COLORS.bidToWin.border.replace('200', '300')} ${COLORS.bidToWin.ring}`
                                    : `${COLORS.bidToWin.bg} ${COLORS.bidToWin.border} hover:${COLORS.bidToWin.bg.replace('50', '100')}`
                            }`}
                        >
                            <div className={`text-sm font-medium ${COLORS.bidToWin.text}`}>✅ Bid to Win</div>
                            <div className={`text-xl font-bold ${COLORS.bidToWin.value}`}>{quadrantCounts['bid-to-win']}</div>
                        </button>
                        <button
                            onClick={() => setSelectedQuadrant(selectedQuadrant === 'faster-closure' ? null : 'faster-closure')}
                            className={`p-3 rounded-lg border transition-all ${
                                selectedQuadrant === 'faster-closure'
                                    ? `${COLORS.fasterClosure.bg.replace('50', '100')} ${COLORS.fasterClosure.border.replace('200', '300')} ${COLORS.fasterClosure.ring}`
                                    : `${COLORS.fasterClosure.bg} ${COLORS.fasterClosure.border} hover:${COLORS.fasterClosure.bg.replace('50', '100')}`
                            }`}
                        >
                            <div className={`text-sm font-medium ${COLORS.fasterClosure.text}`}>⏳ Faster Closure</div>
                            <div className={`text-xl font-bold ${COLORS.fasterClosure.value}`}>{quadrantCounts['faster-closure']}</div>
                        </button>
                        <button
                            onClick={() => setSelectedQuadrant(selectedQuadrant === 'build-capability' ? null : 'build-capability')}
                            className={`p-3 rounded-lg border transition-all ${
                                selectedQuadrant === 'build-capability'
                                    ? `${COLORS.buildCapability.bg.replace('50', '100')} ${COLORS.buildCapability.border.replace('200', '300')} ${COLORS.buildCapability.ring}`
                                    : `${COLORS.buildCapability.bg} ${COLORS.buildCapability.border} hover:${COLORS.buildCapability.bg.replace('50', '100')}`
                            }`}
                        >
                            <div className={`text-sm font-medium ${COLORS.buildCapability.text}`}>🔧 Build Capability</div>
                            <div className={`text-xl font-bold ${COLORS.buildCapability.value}`}>{quadrantCounts['build-capability']}</div>
                        </button>
                        <button
                            onClick={() => setSelectedQuadrant(selectedQuadrant === 'no-bid' ? null : 'no-bid')}
                            className={`p-3 rounded-lg border transition-all ${
                                selectedQuadrant === 'no-bid'
                                    ? `${COLORS.noBid.bg.replace('50', '100')} ${COLORS.noBid.border.replace('200', '300')} ${COLORS.noBid.ring}`
                                    : `${COLORS.noBid.bg} ${COLORS.noBid.border} hover:${COLORS.noBid.bg.replace('50', '100')}`
                            }`}
                        >
                            <div className={`text-sm font-medium ${COLORS.noBid.text}`}>❌ No Bid</div>
                            <div className={`text-xl font-bold ${COLORS.noBid.value}`}>{quadrantCounts['no-bid']}</div>
                        </button>
                    </div>

                    {selectedQuadrant && (
                        <div className="bg-white p-3 rounded-lg border border-[#DBE2EF]">
                            <p className="text-sm text-[#3F72AF]">
                                Showing {filteredData.length} reviews in selected quadrant. Click the quadrant again to show all reviews.
                            </p>
                        </div>
                    )}

                    {/* Main Chart */}
                    <div className="flex-1 bg-white rounded-lg border border-[#DBE2EF] p-4">
                        {scoreData.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <BarChart3 className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-lg">No scoring data available</p>
                                    <p className="text-gray-400 text-sm mt-2">Reviews need to have completed scoring results to appear here</p>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                                    {/* Quadrant backgrounds */}
                                    <ReferenceArea x1={0} x2={abilityQualCutoff} y1={0} y2={attractQualCutoff} fill={COLORS.noBid.area} />
                                    <ReferenceArea x1={abilityQualCutoff} x2={100} y1={0} y2={attractQualCutoff} fill={COLORS.fasterClosure.area} />
                                    <ReferenceArea x1={0} x2={abilityQualCutoff} y1={attractQualCutoff} y2={100} fill={COLORS.buildCapability.area} />
                                    <ReferenceArea x1={abilityQualCutoff} x2={100} y1={attractQualCutoff} y2={100} fill={COLORS.bidToWin.area} />
                                    
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <ReferenceLine x={abilityQualCutoff} stroke="#9ca3af" strokeDasharray="2 2" />
                                    <ReferenceLine y={attractQualCutoff} stroke="#9ca3af" strokeDasharray="2 2" />
                                    
                                    <XAxis
                                        type="number"
                                        dataKey="abilityToWin"
                                        name="Ability to Win"
                                        domain={[0, 100]}
                                        tick={{ fontSize: 12, fill: '#374151' }}
                                        tickLine={{ stroke: '#9ca3af' }}
                                        axisLine={{ stroke: '#9ca3af' }}
                                        label={{
                                            value: "Ability to Win %",
                                            position: "insideBottom",
                                            offset: -20,
                                            style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                                        }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="attractiveness"
                                        name="Opportunity Attractiveness"
                                        domain={[0, 100]}
                                        tick={{ fontSize: 12, fill: '#374151' }}
                                        tickLine={{ stroke: '#9ca3af' }}
                                        axisLine={{ stroke: '#9ca3af' }}
                                        label={{
                                            value: "Opportunity Attractiveness %",
                                            angle: -90,
                                            position: "insideLeft",
                                            style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                                        }}
                                    />
                                    
                                    <Tooltip content={<CustomTooltip />} />
                                    
                                    <Scatter name="Review Scores" data={filteredData}>
                                        {filteredData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={getScoreColor(entry.attractiveness, entry.abilityToWin, qualificationCutoff)}
                                                stroke="#ffffff"
                                                strokeWidth={2}
                                                r={6}
                                            />
                                        ))}
                                    </Scatter>

                                    {/* Quadrant labels */}
                                    <ReferenceDot x={abilityQualCutoff/2} y={attractQualCutoff/2} r={0} isFront={true}
                                        label={{ value: "❌ No Bid", position: "center", fill: COLORS.noBid.label, fontWeight: "bold", fontSize: 11 }} />
                                    <ReferenceDot x={(abilityQualCutoff + 100)/2} y={attractQualCutoff/2} r={0} isFront={true}
                                        label={{ value: "⏳ Faster Closure", position: "center", fill: COLORS.fasterClosure.label, fontWeight: "bold", fontSize: 10 }} />
                                    <ReferenceDot x={abilityQualCutoff/2} y={(attractQualCutoff + 100)/2} r={0} isFront={true}
                                        label={{ value: "🔧 Build Capability", position: "center", fill: COLORS.buildCapability.label, fontWeight: "bold", fontSize: 11 }} />
                                    <ReferenceDot x={(abilityQualCutoff + 100)/2} y={(attractQualCutoff + 100)/2} r={0} isFront={true}
                                        label={{ value: "✅ Bid to Win", position: "center", fill: COLORS.bidToWin.label, fontWeight: "bold", fontSize: 11 }} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}