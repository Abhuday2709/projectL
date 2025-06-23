import { Results } from "@/lib/utils";
import { ResponsiveContainer, ScatterChart, ReferenceArea, CartesianGrid, ReferenceLine, XAxis, YAxis, Tooltip, Scatter, Cell, ReferenceDot } from "recharts";

interface ResultDisplayProps {
    results: Results[];
    recommendation: string;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="font-semibold text-sm">Your Score:</p>
                <p className="text-sm text-blue-600">Attractiveness: {data.x.toFixed(1)}%</p>
                <p className="text-sm text-green-600">Ability to Win: {data.y.toFixed(1)}%</p>
            </div>
        );
    }
    return null;
};

export default function ResultDisplay({ results, recommendation }: ResultDisplayProps) {
    if (results.length < 2) {
        return (
            <div className="flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-gray-500 text-lg">Submit to view results</p>
                    <p className="text-gray-400 text-sm mt-2">Complete the evaluation to see your scoring matrix</p>
                </div>
            </div>
        );
    }

    const cat1Pct = Math.round((results[0]?.score * 100) / (results[0]?.total * 2));
    const cat2Pct = Math.round((results[1]?.score * 100) / (results[1]?.total * 2));

    return (
        <div className="flex flex-col">
            {/* Score Summary */}
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Evaluation Results</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm font-medium text-blue-800">{results[0]?.categoryName}</div>
                        <div className="text-xl font-bold text-blue-900">
                            {results[0]?.score}/{results[0]?.total * 2}
                        </div>
                        <div className="text-sm text-blue-600">
                            {cat1Pct}%
                        </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-sm font-medium text-green-800">{results[1]?.categoryName}</div>
                        <div className="text-xl font-bold text-green-900">
                            {results[1]?.score}/{results[1]?.total * 2}
                        </div>
                        <div className="text-sm text-green-600">
                            {cat2Pct}%
                        </div>
                    </div>
                </div>
                {/* Recommendation */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-lg border border-purple-200">
                    <div className="text-sm font-medium text-purple-800 mb-1 flex justify-center">Recommendation</div>
                    <div className="text-xl font-bold text-purple-900 flex justify-center">{recommendation}</div>
                </div>
            </div>
            {/* Enhanced Chart */}
            <div className="flex-1 min-h-0">
                <div className="w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                            {/* Quadrant backgrounds */}
                            <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#fca5a5" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={75} y1={0} y2={50} fill="#fbbf24" fillOpacity={0.3} />
                            <ReferenceArea x1={75} x2={100} y1={0} y2={50} fill="#fbbf24" fillOpacity={0.3} />
                            <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#60a5fa" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={100} y1={75} y2={100} fill="#34d399" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={100} y1={50} y2={75} fill="#34d399" fillOpacity={0.3} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <ReferenceLine x={50} stroke="#9ca3af" strokeDasharray="2 2" />
                            <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="2 2" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Attractiveness"
                                domain={[0, 100]}
                                tick={{ fontSize: 12, fill: '#374151' }}
                                tickLine={{ stroke: '#9ca3af' }}
                                axisLine={{ stroke: '#9ca3af' }}
                                label={{
                                    value: "Attractiveness %",
                                    position: "insideBottom",
                                    offset: -10,
                                    style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                                }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Ability to Win"
                                domain={[0, 100]}
                                tick={{ fontSize: 12, fill: '#374151' }}
                                tickLine={{ stroke: '#9ca3af' }}
                                axisLine={{ stroke: '#9ca3af' }}
                                label={{
                                    value: "Ability to Win %",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Scatter
                                name="Your Score"
                                data={[{ x: cat1Pct, y: cat2Pct }]}
                                fill="#8b5cf6"
                            >
                                <Cell fill="#8b5cf6" stroke="#ffffff" strokeWidth={3} />
                            </Scatter>
                            <ReferenceDot x={25} y={25} r={0} isFront={true}
                                label={{ value: "❌ No Bid", position: "center", fill: "#dc2626", fontWeight: "bold", fontSize: 11 }} />
                            <ReferenceDot x={75} y={25} r={0} isFront={true}
                                label={{ value: "🔧 Build Capability", position: "center", fill: "#d97706", fontWeight: "bold", fontSize: 11 }} />
                            <ReferenceDot x={25} y={75} r={0} isFront={true}
                                label={{ value: "⏳ Faster Closure", position: "center", fill: "#2563eb", fontWeight: "bold", fontSize: 10 }} />
                            <ReferenceDot x={75} y={75} r={0} isFront={true}
                                label={{ value: "✅ Bid to Win", position: "center", fill: "#059669", fontWeight: "bold", fontSize: 11 }} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}